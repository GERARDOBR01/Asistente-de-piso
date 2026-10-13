# REA al 100 % — instalación y verificación (sesión 2026-10-13)

> **Qué es REA.** *Reverse Engineer Anything* (`rea-agents`, MIT) es una herramienta que da
> a un agente (o a la terminal) la capacidad de **inspeccionar software ya compilado** —APK,
> binarios nativos, apps JavaScript/Electron, .NET, webs— y explicar cómo funciona **con
> evidencia** (cada conclusión trae su `evidence_id`, y separa lo observado de lo inferido).
> Sitios: <https://rea.tools/> y <https://github.com/morluto/rea>.
>
> En esta sesión REA se usó **solo para análisis estático** del APK público de un competidor
> (YOOBIC), como insumo de un estudio competitivo. No se ejecutó la app, no se tocó ningún
> servidor de terceros, y **nada de su código/recursos entra a este repositorio**.

## Entorno (verificado)

| Pieza | Estado |
|---|---|
| Node | v22.22.0 (REA pide `^22.19 \|\| ^24.11 \|\| >=26`) ✓ |
| JDK | OpenJDK **21** completo (`javac` presente; Ghidra y JADX necesitan JDK 17+) ✓ |
| Chromium | `/opt/pw-browsers/chromium` (para análisis de webs) ✓ |
| CPU/RAM/disco | 4 núcleos · 15 GB RAM · ~30 GB libres ✓ |
| Virtualización | **sin KVM** → no hay emulador Android ni `adb`: el APK se analiza **estático** |

## Lo que se instaló

| Componente | Versión | Cómo | SHA-256 |
|---|---|---|---|
| CLI/servidor REA | `rea-agents@6.4.0` | `npm i -g rea-agents@6.4.0` | — (npm) |
| Motor Android (JADX headless MCP) | 0.7.1 | release de `1013503897/jadx-headless-mcp` | `6e5eacf5…73ff75` |
| Recursos (Apktool) | 2.12.1 | jar de `iBotPeaches/Apktool` + wrapper `apktool-run` | `66cf4524…43aeafa` |
| Motor nativo (Ghidra) | **12.1.4** PUBLIC | release de `NationalSecurityAgency/ghidra` (`…20260921.zip`) | `ddac49f9…d2d4db` |
| Navegador | Chromium (del contenedor) | `REA_BROWSER_EXECUTABLE` | — |

> Nota: REA 6.4.0 **exige la línea Ghidra 12.1.x** (primero se bajó 11.4.2 y `rea doctor` lo
> marcó `config_drift`; se reemplazó por 12.1.4 y quedó `healthy`).

## Variables de entorno (archivo `rea-env.sh`, fuera del repo, en el scratchpad)

```sh
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export REA_JADX_MCP_JAR=<scratchpad>/dl-jadx/jadx-headless-mcp-0.7.1-all.jar
export REA_APKTOOL_COMMAND=<scratchpad>/dl-apktool/apktool-run      # wrapper: java -jar apktool.jar "$@"
export REA_GHIDRA_INSTALL_DIR=<scratchpad>/dl-ghidra/ghidra_12.1.4_PUBLIC
export GHIDRA_INSTALL_DIR=<scratchpad>/dl-ghidra/ghidra_12.1.4_PUBLIC
export REA_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium
```

Los binarios pesados (JARs, Ghidra, el APK, los volcados) **no se commitean**: viven en el
scratchpad de la sesión. Aquí quedan las versiones y hashes para poder reproducirlo.

## Verificación (`rea doctor`)

Tras apuntar Ghidra 12.1.4, los chequeos clave dan `healthy`:

- `node` 22.22.0 ✓ · `host` ubuntu 24.04 ✓
- `ghidra` 12.1.4 ✓ · `ghidra-headless` `support/analyzeHeadless` ✓ · `ghidra-native_decompiler`
  (ELF x86_64, concuerda con linux/x64) ✓ · `ghidra-java` JDK 21 ✓
- Proveedor **jadx** 0.7.1 ✓ · Proveedor **apktool** 2.12.1 ✓ (`rea inspect-apktool-client`)
- No configurados (no hacían falta aquí): **Hopper** (GUI de macOS) e **IDA** (comercial).

## Potencia disponible vs. usada en este target

REA quedó listo "al 100 %" para: **Android** (clases/métodos/referencias/manifiesto),
**recursos** (Apktool), **binarios nativos** (Ghidra headless, decompilación de `.so`/ELF),
**JavaScript/Electron** (reconstrucción estática de bundles) y **web** (Chromium).

El APK de YOOBIC resultó ser una **app híbrida Capacitor (Angular/Ionic)** con **0 librerías
nativas `.so`** propias: por eso el motor **nativo (Ghidra) quedó verde pero sin nada que
decompilar en este target**, y el valor del análisis está en el **bundle JavaScript** y en los
**recursos/i18n**, cubiertos por los motores JS y de recursos de REA. Ver `../analisis/yoobic-estatico.md`.
