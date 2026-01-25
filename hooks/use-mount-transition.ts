import { useEffect, useState } from "react"

/**
 * A custom hook that allows for a component to stay mounted for a specified duration
 * after the `isMounted` prop becomes false. This is useful for playing exit animations.
 * 
 * @param isMounted - The boolean state that controls "logical" visibility
 * @param unmountDelay - The delay in ms to wait before "physically" unmounting
 * @returns boolean - True if the component should be rendered in the DOM
 */
export function useMountTransition(isMounted: boolean, unmountDelay: number): boolean {
    const [hasTransitionedIn, setHasTransitionedIn] = useState(false)

    useEffect(() => {
        let timeoutId: NodeJS.Timeout

        if (isMounted && !hasTransitionedIn) {
            setHasTransitionedIn(true)
        } else if (!isMounted && hasTransitionedIn) {
            timeoutId = setTimeout(() => setHasTransitionedIn(false), unmountDelay)
        }

        return () => {
            clearTimeout(timeoutId)
        }
    }, [unmountDelay, isMounted, hasTransitionedIn])

    return hasTransitionedIn
}
