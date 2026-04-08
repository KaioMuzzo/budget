import express from 'express'
import { router } from './routes'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3333

app.use(express.json())
app.use(express.static('../frontend'))

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.use('/api', router)
app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})