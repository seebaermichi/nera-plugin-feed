import { describe, it, expect } from 'vitest'
import * as plugin from '../index.js'

describe('plugin hooks', () => {
    it('exports the synchronous hooks core calls', () => {
        expect(typeof plugin.getAppData).toBe('function')
        expect(typeof plugin.getAssets).toBe('function')
        expect(plugin.getAppData.constructor.name).toBe('Function')
        expect(plugin.getAssets.constructor.name).toBe('Function')
    })
})
