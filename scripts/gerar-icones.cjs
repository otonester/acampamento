// Gera os ícones PNG do PWA a partir de public/favicon.svg. Requer o pacote playwright disponível.
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
;(async () => {
  const svg = readFileSync('public/favicon.svg', 'utf8')
  const square = svg.replace('rx="112"', 'rx="0"')
  const maskable = square.replace('<path d="M256 112 96', '<g transform="translate(51 51) scale(.8)"><path d="M256 112 96').replace('</svg>', '</g></svg>')
  const b = await chromium.launch()
  for (const [file, size, src] of [['icon-192.png', 192, svg], ['icon-512.png', 512, svg], ['apple-touch-icon.png', 180, square], ['icon-maskable-512.png', 512, maskable]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } })
    await p.setContent(`<!doctype html><style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${src}`)
    await p.screenshot({ path: `public/${file}`, omitBackground: true })
    await p.close()
  }
  await b.close()
})()
