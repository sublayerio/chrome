const puppeteer = require('puppeteer')
const uuid = require('uuid')
const fs = require('fs')
const path = require('path')
const get = require('lodash/get')
const template = require('lodash/template')
const isString = require('lodash/isString')

const generateHtmlPage = (responses) => {

    return `
        <html>
        <body>
        ${responses.map(response => `<img src="${response.response.screenshotUrl}" />`).join('')}
        </body>
        </html>
    `
}

module.exports = async ({ id, actions }) => {

    const browser = await puppeteer.launch({
        args: [
            // Required for Docker version of Puppeteer
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // This will write shared memory files into /tmp instead of /dev/shm,
            // because Docker’s default for /dev/shm is 64MB
            '--disable-dev-shm-usage'
        ]
    })

    const page = await browser.newPage()

    await page.setViewport({
        width: 2560,
        height: 1400,
        deviceScaleFactor: 1,
    })

    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.80 Safari/537.36")

    const interceptDownloadUrl = () => new Promise((resolve, reject) => {

        let interval = setInterval(() => {
            resolve(null)
        }, 15000 * 2)

        page.on('response', response => {

            const url = response.url()
            const headers = response.headers()

            // console.log('response', url, headers)

            if (headers['content-type'] === 'application/pdf') {
                clearInterval(interval)
                resolve(url)
            }
        })
    })

    const assetsPath = path.join(__dirname, '/assets')

    const ctx = { actions: [] }

    const getVar = ctx => (action, name) => {

        const initialValue = get(action.payload, name)
        let value = initialValue

        if (isString(value)) {
            value = template(value)(ctx)
            if (initialValue !== value) {
                action.payloadEval = action.payloadEval || {}
                action.payloadEval[name] = value
            }
        }

        return value
    }

    for (const action of actions) {

        const id = uuid.v4()

        const screenshotUrl = `${process.env.HOST}/assets/${id}.png`

        let result = null

        try {
            if (action.type === 'goto') {
                await page.goto(getVar(ctx)(action, 'url'), { waitUntil: 'load' })
                result = { status: 'success', screenshotUrl }
            }

            if (action.type === 'click') {
                await page.click(getVar(ctx)(action, 'selector'))
                result = { status: 'success', screenshotUrl }
            }

            if (action.type === 'select') {
                const selector = getVar(ctx)(action, 'selector')
                const attribute = getVar(ctx)(action, 'attribute')
                const data = await page.$eval(selector, (el, attribute) => {
                    return el[attribute]
                }, attribute)
                result = { status: 'success', data, screenshotUrl }
            }

            if (action.type === 'interceptDownloadUrl') {
                await page.click(getVar(ctx)(action, 'selector'))
                const data = await interceptDownloadUrl()
                result = { status: 'success', data, screenshotUrl }
            }

            if (getVar(ctx)(action, 'timeout')) {
                await page.waitFor(getVar(ctx)(action, 'timeout'))
            }
        } catch (e) {
            result = { status: 'error', message: e.message, screenshotUrl }
        }


        await page.screenshot({
            path: `${assetsPath}/${id}.png`
        })

        ctx.actions.push({
            request: action,
            response: result
        })
    }

    const htmlReport = `${uuid.v4()}.html`

    fs.writeFileSync(path.join(assetsPath, htmlReport), generateHtmlPage(ctx.actions))

    await browser.close();

    return {
        id,
        actions: ctx.actions,
        htmlReportUrl: `${process.env.HOST}/assets/${htmlReport}`
    }
}