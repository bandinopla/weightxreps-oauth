import { useEffect, useState } from 'react'  
import { useWeightxrepsOAuth } from './oauth/useWeightxrepsOAuth'



function App() {
  const [accessToken, setAccessToken] = useState("---")
  const { login, user, getAuthHeaders, loading, error, logout } = useWeightxrepsOAuth("dev.foo.com",{ endpoint:import.meta.env.VITE_WERIGHTXREPS_OAUTH, scope:"email,jwrite" })
 

  const go = ()=>{ 

    //getAuthHeaders(true).then(headers=>setAccessToken(JSON.stringify(headers)))
    login();
  }

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
        <p>
            Loading: {loading?"Loading...":"---"}
        </p>
        <strong>{ error ?? "---"}</strong>
    </>
  )
}

export default App
