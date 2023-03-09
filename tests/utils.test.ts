import { uniqBy } from '../src/utils'

describe('uniqBy', () => {
    it('should uniq by key', () => {
        const array = [
            { id: 5 },
            { id: 5 }
        ]

        expect(uniqBy(array, doc => doc.id)).toHaveLength(1)
    })
})