import {app} from './app'

const PORT = process.env.PORT || 25000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
