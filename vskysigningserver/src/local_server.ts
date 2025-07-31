// Load environment variables first, before any other imports
import './config'

import {app} from './app'

const PORT = process.env.PORT || 25000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
