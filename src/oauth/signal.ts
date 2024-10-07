 
export interface ReadOnlySignal<T> {
    get value():T;
    listen(listener: (val: T) => void, callNow:boolean);
}

export class Signal<T> implements ReadOnlySignal<T> {
    private listeners = new Set<(val: T) => void>();

    constructor(private _value: T) {}

    get value() {
        return this._value;
    }

    set value(newValue: T) {
        this._value = newValue;
        Array.from(this.listeners).forEach(listener => listener(newValue));
    }

    listen(listener: (val: T) => void, callNow = false) {
        this.listeners.add(listener);
        if( callNow ) listener(this._value);
        return () => { this.listeners.delete(listener) };
    } 

    get asReadOnly() {
        return this as ReadOnlySignal<T>
    }
}