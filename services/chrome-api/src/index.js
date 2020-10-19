const pkg = require('../package.json')
const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const app = express()
const auth = require('./middleware/auth')
const handleRun = require('./handleRun')

const PORT = process.env.PORT || 3000


app.use(
    morgan('combined')
)

app.use('/assets', express.static(__dirname + '/assets'))

app.post('/run', auth, bodyParser.json(), async (req, res) => {

    try {

        const { id, actions } = req.body

        const data = await handleRun({
            id,
            actions
        })

        res.send({
            status: 'success',
            data
        })

    } catch (e) {
        res.send(e.message)
    }
})

app.get("/", (req, res) => {
    res.send({
        name: pkg.name,
        version: pkg.version
    })
})

app.listen(PORT, () =>
    console.log(`${pkg.name}@${pkg.version} running at port ${PORT}`)
)