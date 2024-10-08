# `weightxreps.net` OAuth module

Module to let your javascript app get user's credentials of [weightxreps.net](https://weightxreps.net/). It only focus on obtaining a valid access token, you are then responsible of adding it to your request's headers when connecting to the GraphQL endpoint `/api/graphql`

### @ See [OAuth2 weightxreps documentation](https://github.com/bandinopla/weightxreps-server/blob/main/docs/OAUTH.md)
Read that to know how to create a service to connect your app with weightxreps.net.
<br/>


---
# Install
```
npm i weightxreps-oauth
```
To use the module you have 2 options:
1. [Vanilla JS](#option-a-vanilla-js)
2. [React Hook](#option-b---react-hook)
<br/><br/>

---
# Option A - Vanilla JS
Use the javascript client object directly...
```js
import { OAuthClient } from "weightxreps-oauth";
let client = OAuthClient.get( client_id, config_options ) 
``` 
### CLIENT CONFIG OPTIONS `{...}`
| key | description |
| --------------- | --- |
| `fetch` | custom fetch function. Defaults to `fetch` |
| `endpoint` | Default: `https://weightxreps.net/oauth` |
| `asPopup` | Boolean. Default: `true`. How the user will be redirected to the weightxreps login page. |
| `redirectUri` | after login, where should be redirect? If you use `asPopup` it will be ignored.
| `store` | Defaults to `localStorage` | 
| `scope` | Comma separated scopes
### CLIENT API `client.key`
| key | description |
| --- | --- |
| `async login():void` | Will redirect user to the login page if necesary or login using cached data in the `store`. You will have to add listeners to `onLogged` or `onError` to act acordingly... |
| `logout():void` | Removes tokens form the client's `store` and signals `undefined` for token and user. |
| `getRequestHeadersSync():Object` | Assumes we are already logged, takes the access token from the cache. |
| `async getRequestHeadersAsync( loginIfNeeded = false):Object` | same as above but will redirect the user to the login page if necesary to get the access token |

### SIGNALS
| signal | description |
| --- | --- |
| `onError.listen((err:string)=>void, callNow = false):UnlistenFunc` | Signal to get the string error that happened or undefined. `callNow` = true will call the listener with the current value right now. See list of possible errors at the bottom...|
| `onLoading.listen((loading:boolean)=>void, callNow = false):UnlistenFunc`| Signal to know if the client is loading something or not. `callNow` = true will call the listener with the current value right now.|
| `onLogged.listen((user:{id:number, uname:string})=>void, callNow = false):UnlistenFunc`| Signal to know when the user changes. Can be `undefined` if not logged. `callNow` = true will call the listener with the current value right now.|

### REMOVE SIGNAL LISTENER
All the `.listen(...)` return a function `()=>void` that you call when you want to remove the listener from that signal.
```js
let removeListener = client.onLogged( user=>console.log(user),true );
removeListener(); //<--- removing the above's listener.
```
<br/><br/>

---
# Option B - React Hook
A custom hook to quickly interact with the `OAuthClient` in a React application.
### Example
```js
import { useState } from 'react'  
import { useWeightxrepsOAuth } from 'weightxreps-oauth'

function App() { 

  const {   login, 
            user, 
            getAuthHeaders, 
            loading, 
            error, 
            logout } = useWeightxrepsOAuth("dev.foo.com", { ... })
 

  return (
    <>
        {
            user? <div>
                {`Hello ${user.uname}`}
                <button onClick={() => logout() }> Logout </button> 
                </div>
            : 
            <div>
                <button onClick={() => login() }>
                    Login 
                </button> 
            </div>
        }  
    </> );
}

export default App

```
### PARAMETERS `useWeightxrepsOAuth(...)` 
| key | description |
| --- | --- |
| clientId | The first parameter is `your client id`, the id of you app. You create this by going to your settings in [weightxreps.net/settings](https://weightxreps.net/settings) and scroll down at the bottom to locate the **Developer API Settings** . |
| options | `Object` containing options for the `OAuthClient` see above... |  

### RETURN `{...} = useWeightxrepsOAuth()` 
| key | description |
| --- | --- |
| `login` | see `client.login` above |
| `getAuthHeaders` | see `client.getRequestHeadersAsync` above |
| `user?` | A weightxreps user... basically `{ id:string, uname:string}` |
| `error?` | `String` in case of an error |
| `logout` | See `client.logout` above |
| `loading` | `boolean` true if the client is busy |


### ERRORS
- `"user_declined"` - The user declined to grant our app authorization
- `"user_canceled"` - User closed the popup (if you used `asPopup:true`)
- `"must_login"` - A manual login by the user is necesary. Example: the refresh token is no longer valid or something... 
- `<string>` - Anything else will be a string describind the error...