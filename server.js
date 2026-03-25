import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Раздаем статические файлы
app.use(express.static(path.join(__dirname, 'dist')))

// Для SPA - все маршруты ведем на index.html
// Используем регулярное выражение вместо '*'
app.get(/.*/, (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// Запускаем сервер
const server = app.listen(PORT, '0.0.0.0', () => {
	console.log(`✅ Server running on http://0.0.0.0:${PORT}`)
	console.log(`📁 Serving files from ${path.join(__dirname, 'dist')}`)
})

// Обработка завершения процесса
process.on('SIGTERM', () => {
	console.log('SIGTERM signal received: closing HTTP server')
	server.close(() => {
		console.log('HTTP server closed')
		process.exit(0)
	})
})
