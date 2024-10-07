import { Signal } from "./signal";
import { Store } from "./store";


export type Options = {
    fetch: typeof fetch,
    endpoint: string,
    asPopup: boolean,
    redirectUri: string,
    store: typeof localStorage,
    scope: string
};

export interface WxrUser {
    id:number,
    uname:string,
    email?:string
}


const defaultOptions: Options = {
    fetch: window.fetch.bind(window),
    endpoint: "https://weightxreps.net/api/auth",
    asPopup: false,
    redirectUri: undefined,
    store: localStorage,
    scope: "not-set"
}

type Token = {
    access_token: string,
    refresh_token: string,
    expirationTime: number,
    token_type: string
}

type GetAuthCodeResult = { code: string, "token-endpoint": string, state: string } | { error: string, state: string };

type WindowMessagePayload = {
    weightxrepsOnOAuthResult: GetAuthCodeResult
}
type WindowMessageEvent = MessageEvent<WindowMessagePayload>;
 
export class OAuthClient extends EventTarget { 

    static USER_CANCELED_AUTH_ERROR = 'user_canceled';
    static USER_DECLINED_AUTH_ERROR = 'user_declined';
    static USER_MUST_LOGIN = 'must_login';

    private static dicc = new Map<string, OAuthClient>();

    static get = (clientId, options) => {
        // Check if an instance for the clientId already exists in the map
        if (OAuthClient.dicc.has(clientId)) {
            return OAuthClient.dicc.get(clientId)!; // Return existing instance
        }

        // Create a new instance if it doesn't exist
        const instance = new OAuthClient(clientId, options);

        // Store the new instance in the map
        OAuthClient.dicc.set(clientId, instance);

        return instance; // Return the new instance
    }

    private options: Options;
    readonly instanceID = '_' + Math.random().toString(36).substr(2, 9); 
    private _pkceCodeVerifier: string;
    private _token: Token | undefined;
    private store: Store;
    
    private _user = new Signal<WxrUser>(undefined);   
    private _onTokenUpdated = new Signal<Token>(undefined);
    private _isLoading = new Signal<boolean>( false);
    private _error = new Signal<string>(undefined);


    public get onLogged() {
        return this._user.asReadOnly;
    }

    public get onLoading() {
        return this._isLoading.asReadOnly;
    }

    public get onError() {
        return this._error.asReadOnly;
    } 

    private get pkceCodeVerifier(): string {
        return this._pkceCodeVerifier ?? this.store.getItem("wxr-pkce-code-verifier");
    }

    private set pkceCodeVerifier(code: string) {
        this._pkceCodeVerifier = code;
        this.store.setItem("wxr-pkce-code-verifier", code);
    }

    private set token(t: Token | undefined) {

        this._token = t; 

        if (!t) {  
            this.pkceCodeVerifier = null; 
        } 

        this.store.setObject("wxr-accessToken", t);
        this._onTokenUpdated.value = t;
    }

    private get token() {
        if (this._token) return this._token;
        let storedToken :Token = this.store.getObject("wxr-accessToken");

        this._token = storedToken; 
        return storedToken;
    }

    public async getRequestHeadersAsync( loginIfNeeded = false ) {

        await this.getFreshToken(loginIfNeeded);
 
        return this.getRequestHeadersSync();
    }

    public getRequestHeadersSync() { 
        return {
            Authorization: `${this.token.token_type} ${this.token.access_token}`
        };
    }


    constructor(readonly clientId: string, options?: Options) {
        super();
        this.options = Object.assign({ ...defaultOptions }, options);
        this.store = new Store(clientId, this.options.store);

        this.setup()
    }

    private setup() { 

        this._isLoading.listen( loading => {
            if( loading )
            {
                this._error.value = undefined;
            }   
        })

        requestAnimationFrame(async () => {

            try
            {
                await this.continueLoginFlow();

                // if( !await this.continueLoginFlow() )
                // {  
                //     await this.getFreshToken(false);
                // }
            }
            catch(error)
            {
                if( error.message==OAuthClient.USER_MUST_LOGIN )
                {
                    // silent error... do nthing.
                }
                else 
                {
                    // startup error... report it.
                    this._error.value = error.message;
                }
            } 

        });
    }

    /**
     * Check if the querystring has a `code` param which means we landed here with an authorization code provided...
     * @returns true if we are logged.
     */
    private async continueLoginFlow() {  

        //
        // check if we are logged based on our cache!!
        //
        try
        {  
            if( await this.getFreshToken(false) )
            {
                return true;
            } 
        }
        catch(err)
        {
            if( err.message==OAuthClient.USER_MUST_LOGIN )
            {
                // ignore...
            }
            else 
            {
                throw err;
            }
        }  


        // hay flow?

        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        const queryParams = new URLSearchParams(url.search);
        const authCode = queryParams.get("code");
        const authError = queryParams.get("error"); 

        if ( authCode ) { //<-- authorization code in the querystring found! 

            //
            // get access token
            //
            await this.onAuthorizationCode(Object.fromEntries(queryParams.entries()) as GetAuthCodeResult); 

            //
            // remove querystring
            //
            const url = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, url);

            return true;
        } 
        else if( authError )
        {
            this._error.value = authError;
            return true;
        }
 
        return false;
    }

    /**
     * request an access token using this authorization code.
     */
    private async onAuthorizationCode(authParams: GetAuthCodeResult) {
 
        if ( "error" in  authParams) {
            throw new Error(authParams.error); 
        }

        // we will need this from now on... 

        // now one last step is to ask for the access token!
        return await this.getAccessToken(authParams.code);
    }

    /**
     * Will activate in case the login opens a popup window and the popup will send us a message after login or error.
     */
    private onWindowMessage() {

        return new Promise<GetAuthCodeResult>((resolve, reject) => {
            const listener = (event: WindowMessageEvent) => {
                let origin = new URL(this.options.endpoint);

                if (event.origin === `${origin.protocol}//${origin.host}`) {
                    const payload = event.data.weightxrepsOnOAuthResult;

                    //if (payload && payload.state == this.instanceID) {
                    if (payload) { 
                        window.removeEventListener("message", listener);
                        resolve(payload);
                    }
                }
            }

            //TODO: reject on timeout???

            window.addEventListener('message', listener);
        });


    }

    /** 
    * @see https://github.com/node-oauth/node-oauth2-server/blob/6a1cf188d5e19faa7ae7569faed1dd51f191a802/lib/token-types/bearer-token-type.js#L33
    */
    private onGetTokenResponse(res: any) {

        if (res && this.token == res) return this.token;

        if (res.error) {
            throw new Error(res.error_description || res.error);
        }
 
        res.expirationTime = Date.now() + res.expires_in * 1000;

        this.token = res; 

        return this.token;
    }

    /**
     * Fetchs a token. When a new token is fetched we also get the user info.
     */
    private async fetchToken( extraParams = "", refresh = false )
    {
        if (!refresh && !this.pkceCodeVerifier) { 
 
            throw new Error("Code verifier was not found (you probably cleared the localStorage?)")
        }

        let params = `${extraParams?extraParams+"&":""}client_id=${this.clientId}&`;

        params += refresh? `refresh_token=${this.token.refresh_token}&grant_type=refresh_token`
                        : `grant_type=authorization_code&code_verifier=${this.pkceCodeVerifier}`;

        if( !refresh )
            this.pkceCodeVerifier = null; //<-- not needed anymore.

        this._isLoading.value = true;

        try { 

            return await this.options.fetch(this.options.endpoint+"/token", {
                method: 'POST',
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            })   
                .then( res => res.json())
                .then( res => this.onGetTokenResponse(res))
                .then( token => refresh? token : this.getUser().then(()=>token) )
                ;
        }
        catch( error )
        { 
            throw error;
        }
        finally {
            this._isLoading.value = false;
        }

    }

    /**
     * Get the token that will allow us to act on behalf of the user!
     */
    private async getAccessToken(authCode: string) {
 
        return await this.fetchToken(`code=${authCode}`, false); 
    }

    private async refreshToken(redirectToLoginIfRequired: boolean = true) {

        if (!this.token) throw new Error("There's no token to refresh! (weird...)");

        try
        {
            var token = await this.fetchToken(``, true);
        }
        catch( err )
        {
            if (err.message.startsWith("Refresh token not found")) 
            {
                if (redirectToLoginIfRequired) 
                {
                    return await this.redirectUserToLogin();
                }
                else 
                {
                    throw new Error(OAuthClient.USER_MUST_LOGIN);
                }
            }
            else {
                throw err;
            }
        } 

    }

    private mustBeHTTPS() {
        if (window.location.protocol !== 'https:') {
            throw new Error('Login requires HTTPS. Please access this site over a secure connection.');
        }
    }

    /**
     * Sends user to weigthxreps to login and grant us access so we can get an access token
     */
    private async redirectUserToLogin() 
    {  

        const currentUri = `${window.location.protocol}//${window.location.host}${window.location.pathname}`; 
        const pkceCodeVerifier = await generatepkceCodeVerifier();
        const codeChallenge = await generateCodeChallenge(pkceCodeVerifier);
        const codeChallengeMethod = "S256";
        const redirectUri = this.options.asPopup ? currentUri : this.options.redirectUri ?? currentUri;

        this.pkceCodeVerifier = pkceCodeVerifier;

        const url = this.options.endpoint + "?grant_type=authorization_code&response_type=code&client_id=" + encodeURIComponent(this.clientId) + "&redirect_uri=" + encodeURIComponent(redirectUri) + "&state=" + this.instanceID + "&code_challenge=" + codeChallenge + "&code_challenge_method=" + codeChallengeMethod + "&scope=" + this.options.scope;

        if ( this.options.asPopup ) {

            const width = 600;
            const height = 600;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;

            this._isLoading.value = true;

            window.open(url, "weightxreps_oauth", `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`) ;// "menubar=no,location=no,resizable=yes,scrollbars=yes,status=no");

            //
            // the modal will send us a message...
            //
            try
            {
                var authCodeResult = await this.onWindowMessage(); 
            }
            catch(err) {
                throw err;
            }
            finally {
                this._isLoading.value = false;
            }
            

            return await this.onAuthorizationCode(authCodeResult);
        }
        else 
        {
            window.open(url, "_self"); 
            await new Promise(()=>{});
        }
    }

    /**
     * Gets the access token and makes sure it is not expired.
     * 
     * @param {boolean} loginIfNeeded If true, it will ask user to login if necesary, else, it will throw error if a login is needed...
     * @returns {string} a fresh access token
     */
    private async getFreshToken(loginIfNeeded: boolean) {

        if ( !this.token ) // if we dont have a token...
        {
            if ( loginIfNeeded ) {
                let newToken = await this.redirectUserToLogin();

                return newToken!.access_token;
            }
            else {
                throw new Error(OAuthClient.USER_MUST_LOGIN);
            }
        }
        else // we have a token!
        {
            //
            // check if it is still valid...
            //
            if ( Date.now() >= this.token.expirationTime - 5 * 60 * 1000 ) 
            {
                let newToken = await this.refreshToken(loginIfNeeded);

                return newToken!.access_token;
            }
            else 
            {    
                if( !this._user.value )
                    await this.getUser(); 
            }

            return this.token.access_token;
        }

    } 

    private async getUser() {

        const header    = await this.getRequestHeadersSync();

        this._isLoading.value = true;

        try {
            var response  = await fetch( this.options.endpoint.replace("auth","graphql") , {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json', 
                ...header 
                },
                body: JSON.stringify({
                operationName:"GetSession",
                query: `query GetSession {
                                getSession {
                                    user {
                                        id
                                        uname
                                        email
                                    }
                                }
                            }
                            ` 
                }),
            });  
        }
        catch(err) 
        { 
            throw err;
        }
        finally 
        {
            this._isLoading.value = false;
        }
 
        //
        // this means the token is now invalid...
        //
        if( response.status==401 )
        {
            this.logout(); 
        }


        const json = await response.json();

        if( json.errors )
        {
            throw new Error( json.errors.flatMap(e=>e.message).join("\n") );
        }
        else if( json.error )
        {
            throw new Error( json.error );
        }

        const user = json.data?.getSession?.user;

        if( !user ) { 
            throw new Error("Unexpected server rersponse...");
        } 

        this._user.value = user; 

        return user;
    }


    /**
     * Connect with weightxreps user. 
     */
    public async login() {
 
        //
        // this will trigger a login if required.
        //
        this._isLoading.value = true; 

        try 
        {
            await this.getFreshToken(true); 
        }
        catch(err) 
        {
            this._error.value = err.message;
        }
        finally {
            this._isLoading.value = false;
        }
        
    }

    /**
     * Logout user from this client. 
     */
    public logout() {
        this.token = undefined; 
        this._user.value = undefined;
    }
}



// Function to encode to Base64 URL
const base64URLEncode = (arrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Generate the code verifier
const generatepkceCodeVerifier = async () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const pkceCodeVerifier = base64URLEncode(array);
    return pkceCodeVerifier;
};

// Generate the code challenge
const generateCodeChallenge = async (pkceCodeVerifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pkceCodeVerifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const codeChallenge = base64URLEncode(hashBuffer);
    return codeChallenge;
};