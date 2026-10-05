/** Единственная тестовая JSX-сессия Chat и его реальных UI-зависимостей. */
import createJsxBunPlugin from "@zavx0z/immersive-jsx-compiler-bun"
import {existsSync, realpathSync} from "node:fs"
import {dirname, resolve} from "node:path"
const chat = resolve(import.meta.dir, "..")
const component = realpathSync(Bun.resolveSync("@zavx0z/immersive-component", chat))
let immersive = dirname(component)
while (!existsSync(resolve(immersive, ".git"))) {
  const parent = dirname(immersive)
  if (parent === immersive) throw new Error("Не найден корень исходников UI")
  immersive = parent
}
Bun.plugin(createJsxBunPlugin({cwd: chat, sourceRoots: [chat, immersive], persistent: true}))
