const express = require('express')
const bodyParser = require('body-parser')
const joi = require('joi')

/**
 * This server mocks http methods from the alpaca api and returns 200 if the requests are formed correctly.
 * Some endpoints might allow you to pass "cheat code" values to trigger specific responses.
 */

const PORT = process.env.TEST_PORT || 3333

function createAlpacaMock({ port = PORT } = {}) {
  const app = express().use(bodyParser.json())
  const v1 = express.Router()
  app.use('/v1', v1)

  v1.get('/account', method(() => accountEntity))

  v1.get('/orders', method((req) => {
    assertSchema(req.query, {
      status: joi.string().optional().valid('open', 'closed', 'all'),
      limit: joi.number().optional().integer().positive().max(500),
      after: joi.string().isoDate().optional(),
      until: joi.string().isoDate().optional(),
      direction: joi.string().optional().valid('asc', 'desc'),
    })
    return [orderEntity]
  }))

  v1.get('/orders/:id', method((req) => {
    if (req.params.id === 'nonexistent_order_id') throw apiError(404)
    return orderEntity
  }))

  v1.get('/orders:by_client_order_id', method((req) => {
    assertSchema(req.query, {
      client_order_id: joi.string().required()
    })
    return orderEntity
  }))

  v1.post('/orders', method((req) => {
    assertSchema(req.body, {
      symbol: joi.string().required(),
      qty: joi.number().required().integer().positive(),
      side: joi.string().required().valid('buy', 'sell'),
      type: joi.string().required().valid('market', 'limit', 'stop', 'stop_limit'),
      time_in_force: joi.string().required().valid('day', 'gtc', 'opg', 'ioc', 'fok'),
      limit_price: joi.number().positive().optional(),
      stop_price: joi.number().positive().optional(),
      client_order_id: joi.string().max(48).optional()
    })
    const { symbol, type, limit_price, stop_price } = req.body
    if (
      (type === 'market' && (limit_price || stop_price))
      || ((type === 'limit' || type === 'stop_limit') && !limit_price)
      || ((type === 'stop' || type === 'stop_limit') && !stop_price)
    ) {
      throw apiError(422)
    }
    if (symbol === 'INSUFFICIENT') {
      throw apiError(403)
    }
    return orderEntity
  }))

  v1.delete('/orders/:id', method((req) => {
    if (req.params.id === 'nonexistent_order_id') throw apiError(404)
    if (req.params.id === 'uncancelable_order_id') throw apiError(422)
  }))

  v1.get('/positions', method(() => [positionEntity]))

  v1.get('/positions/:symbol', method((req) => {
    assertSchema(req.params, {
      symbol: joi.string().required(),
    })
    if (req.params.symbol === 'NONE') {
      throw apiError(404)
    } else if (req.params.symbol === 'FAKE') {
      throw apiError(422)
    }
    return positionEntity
  }))

  v1.get('/assets', method((req) => {
    assertSchema(req.query, {
      status: joi.valid('active', 'inactive').optional(),
      asset_class: joi.string().optional(),
    })
    return [assetEntity]
  }))

  v1.get('/assets/:symbol', method((req) => {
    assertSchema(req.params, { symbol: joi.string().required() })
    if (req.params.symbol === 'FAKE') {
      throw apiError(404)
    }
    return assetEntity
  }))

  v1.get('/calendar', method(() => calendarEntity))

  v1.get('/clock', method(() => clockEntity))

  app.use(method(() => {
    throw apiError(404, 'route not found')
  }))

  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      message: err.message
    })
  })

  return new Promise(resolve => {
    const server = app.listen(port, () => resolve(server))
  })
}

const apiError = (statusCode = 500, message = 'Mock API Error') => {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

const method = (fn) => async (req, res, next) => {
  if (
    !req.get('APCA-API-KEY-ID')
    || !req.get('APCA-API-SECRET-KEY')
    || req.get('APCA-API-SECRET-KEY') === 'invalid_secret'
  ) {
    return next(apiError(401))
  }
  try {
    const result = await fn(req, res, next)
    if (!res.headersSent) res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

const assertSchema = (value, schema) => {
  const result = joi.validate(value, schema)
  if (result.error) {
    throw apiError(422, result.error)
  }
  return result.value
}

const accountEntity = {
  "id": "904837e3-3b76-47ec-b432-046db621571b",
  "status": "ACTIVE",
  "currency": "USD",
  "buying_power": "4000.32",
  "cash": "4000.32",
  "cash_withdrawable": "4000.32",
  "portfolio_value": "4321.98",
  "pattern_day_trader": false,
  "trading_blocked": false,
  "transfers_blocked": false,
  "account_blocked": false,
  "created_at": "2018-10-01T13:35:25Z"
}

const orderEntity = {
  "id": "904837e3-3b76-47ec-b432-046db621571b",
  "client_order_id": "904837e3-3b76-47ec-b432-046db621571b",
  "created_at": "2018-10-05T05:48:59Z",
  "updated_at": "2018-10-05T05:48:59Z",
  "submitted_at": "2018-10-05T05:48:59Z",
  "filled_at": "2018-10-05T05:48:59Z",
  "expired_at": "2018-10-05T05:48:59Z",
  "canceled_at": "2018-10-05T05:48:59Z",
  "failed_at": "2018-10-05T05:48:59Z",
  "asset_id": "904837e3-3b76-47ec-b432-046db621571b",
  "symbol": "AAPL",
  "exchange": "NASDAQ",
  "asset_class": "us_equity",
  "qty": "15",
  "filled_qty": "0",
  "type": "market",
  "side": "buy",
  "time_in_force": "day",
  "limit_price": "107.00",
  "stop_price": "106.00",
  "filled_avg_price": "106.00",
  "status": "accepted"
}

const positionEntity = {
  "asset_id": "904837e3-3b76-47ec-b432-046db621571b",
  "symbol": "AAPL",
  "exchange": "NASDAQ",
  "asset_class": "us_equity",
  "avg_entry_price": "100.0",
  "qty": "5",
  "side": "long",
  "market_value": "600.0",
  "cost_basis": "500.0",
  "unrealized_pl": "100.0",
  "unrealized_plpc": "0.20",
  "unrealized_intraday_pl": "10.0",
  "unrealized_intraday_plpc": "0.0084",
  "current_price": "120.0",
  "lastday_price": "119.0",
  "change_today": "0.0084"
}

const assetEntity = {
  "id": "904837e3-3b76-47ec-b432-046db621571b",
  "asset_class": "us_equity",
  "exchange": "NASDAQ",
  "symbol": "AAPL",
  "status": "active",
  "tradable": true
}

const calendarEntity = {
  "date": "2018-01-03",
  "open": "09:30",
  "close": "16:00"
}

const clockEntity = {
  "timestamp": "2018-04-01T12:00:00.000Z",
  "is_open": true,
  "next_open": "2018-04-01T12:00:00.000Z",
  "next_close": "2018-04-01T12:00:00.000Z"
}

// promise of a mock alpaca server
let serverPromise = null

const start = () => {
  if (!serverPromise) serverPromise = createAlpacaMock()
  return serverPromise
}

const stop = () => {
  if (!serverPromise) return Promise.resolve()
  return serverPromise.then((server) =>
    new Promise(resolve => server.close(resolve))
  )
  .then(() => {
    serverPromise = null
  })
}

const getConfig = () => ({
  baseUrl: `http://localhost:${PORT}`,
  keyId: 'test_id',
  secretKey: 'test_secret',
})


module.exports = {
  start, stop, getConfig
}
