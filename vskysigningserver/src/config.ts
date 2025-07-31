import * as dotenv from 'dotenv'

// Configure dotenv globally for the entire application and
// try to retrieve the highest level .env file first.
dotenv.config({path: '../.env'})
dotenv.config()
