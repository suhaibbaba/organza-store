import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme, DirectionProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import App from './App'
import './i18n'                      // sets up translations + direction
import { loadSettings } from '@/lib/storage'

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: { fontWeight: '600' },
})

const direction = loadSettings().language === 'ar' ? 'rtl' : 'ltr'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DirectionProvider initialDirection={direction}>
      <MantineProvider theme={theme}>
        <ModalsProvider>
          <Notifications position="top-center" zIndex={1000} />
          <App />
        </ModalsProvider>
      </MantineProvider>
    </DirectionProvider>
  </React.StrictMode>,
)
