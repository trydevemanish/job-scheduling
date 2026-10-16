import express from "express"
import { PORT } from '../shared/config'
import { CreateJob } from "../controller/controller";

const app = express();
app.use(express.json())

app.post("/create-job", CreateJob)

/**------------------------------------------------------------------*/
function start(){
    app.listen(PORT, () => console.log(`Server Started at PORT: ${PORT}`))
}

start()


