// @nera-static/plugin-feed — an Atom (or RSS 2.0) feed per language.
//
// Placeholder hooks until ROADMAP slice 4: `getAppData` guards the core
// version, `getAssets` writes nothing yet.
import { assertCoreVersion, coreVersion } from './src/guard.js'

export function getAppData({ app }) {
    assertCoreVersion(coreVersion(process.cwd()))
    return app
}

export function getAssets() {
    return []
}
