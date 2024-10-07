export class Store {
    private k:string;

    constructor(namespace:string, private store:Storage ) {
        this.k = namespace+"--";
    }

    getItem( key:string ) {
        return this.store.getItem(this.k + key )
    }
    
    setItem( key:string, val:string) { 

        if( val == null )
        {
            this.removeItem(key);
            return;
        }
        this.store.setItem(this.k + key, val);
    } 

    getObject( key:string ) {

        let storedToken  = this.getItem(key);
        if( storedToken  )
        {
            try { 
                return JSON.parse(storedToken );
            }
            catch(err) {
                console.error("Failed to recover stored object <"+(this.k + key)+"> from the localstore, got: ", err.message);
            }
        } 
    }

    setObject( key:string, obj:object ) {
        this.setItem( key, JSON.stringify(obj) );
    }

    removeItem(key) {
        this.store.removeItem(this.k + key);
    }
}