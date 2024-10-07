
import { useEffect, useState } from "react"; 

import type { Options } from "./OauthClient";
import { OAuthClient, WxrUser } from "./OauthClient"; 

type Maybe<T> = T | null;
type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };



type HookApi = {
    /**
     * Triggers the login ui flow. Either open a popup window or redirect the page, depending on your settings.
     */
    login: () => Promise<WxrUser>, 

    /**
     * Will contian the basic data of the weightxreps user that granted us the access.
     */
    user?:WxrUser, 

    /**
     * Get headers to be used in `fetch` calls or similar to the weightxreps api.
     * @param loginIfNeeded Will trigger a login same as calling `.login` if needed.
     * @returns an object containing the headers you should add to any request you do to the graphql api
     */
    getAuthHeaders?: (loginIfNeeded?:boolean) => Promise<Object>,

    /**
     * In case of error, this will contain the text or code...
     */
    error?:string,

    /**
     * Logout the user on this client. It just removes the token from the localstorage and will update the user and token to undefined.
     */
    logout: ()=>void,

    loading?:boolean
}

export const useWeightxrepsOAuth = ( client_id:string, options:MakeOptional<Options,"fetch"|"store"|"asPopup"|"redirectUri"> ):HookApi => {

    const [user, setUser] = useState<WxrUser>( undefined ); 
    const [error, setError] = useState<string>()
    const [loading, setLoading] = useState<boolean>()
    const client = OAuthClient.get(client_id, options);

    useEffect(()=>{

        let unsub = client.onLogged.listen(setUser, true);
        let unsubError = client.onError.listen(setError, true);
        let unsubLoading = client.onLoading.listen(setLoading, true);

        return ()=>{
            unsub();
            unsubError();
            unsubLoading();
        }

    },[]);

    return {   
        login: client.login.bind(client),
        getAuthHeaders: client.getRequestHeadersAsync.bind(client),
        user,
        error,
        logout: client.logout.bind(client),
        loading
    };
}
