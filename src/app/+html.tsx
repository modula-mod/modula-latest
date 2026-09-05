import type {ReactNode} from 'react'
import {ScrollViewStyleReset, useServerDocumentContext} from 'expo-router/html'

const registerServiceWorker = `
const isLocalDevelopment = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
if ('serviceWorker' in navigator && !isLocalDevelopment) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', {scope: '/', updateViaCache: 'none'})
      .then(registration => registration.update())
      .catch(() => undefined)
  })
}
`

export default function Root({children}: {children: ReactNode}) {
  const {bodyAttributes, bodyNodes, htmlAttributes, headNodes} = useServerDocumentContext()

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <title>Modula</title>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0B1416" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Modula" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/pwa/icon-192.png" />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
        <script dangerouslySetInnerHTML={{__html: registerServiceWorker}} />
      </body>
    </html>
  )
}
