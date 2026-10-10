/** Единственная тестовая JSX-сессия исходников Chat. */
import createJsxBunPlugin from "@zavx0z/immersive/compiler"
import {resolve} from "node:path"

const chat = resolve(import.meta.dir, "..")

Bun.plugin(createJsxBunPlugin({cwd: chat, sourceRoots: [chat], persistent: true}))
