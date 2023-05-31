/* eslint-disable @typescript-eslint/no-explicit-any */
export function uniqBy<T> (arr: T[], predicate: (item: T) => any): T[] {
	const cb = typeof predicate === 'function' ? predicate : (o: any) => o[predicate]
	const result: T[] = []
	const map = new Map()

	arr.forEach((item) => {
		const key = (item === null || item === undefined) ? item : cb(item)

		if (!map.has(key)) {
			map.set(key, item)
			result.push(item)
		}
	})

	return result
}

export async function sleep (ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}