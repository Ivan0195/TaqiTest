import {Injectable} from "@nestjs/common";
import axios from "axios";
import {graphqlQueries} from "../taqiChat/graphqlQueries";

@Injectable()
export class PtakDemoService {
    filesTempDirectory = `./src/taqiChat/`;
    llama;
    getllama;
    llamaChatSession;
    async checkForFault(data: {prompt: string, file: Express.Multer.File}) {

        const { getLlama, LlamaChatSession, defineChatSessionFunction } = await import("node-llama-cpp");
        this.getllama = getLlama;
        this.llamaChatSession = LlamaChatSession;
        this.llama = await this.getllama();
        const model = await this.llama.loadModel({
            modelPath: `${this.filesTempDirectory}temp/Mistral-7B-Instruct-v0.3.Q3_K_S.gguf`
        });
        const context = await model.createContext();
        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
        });

        const functions = {
            checkPressure: defineChatSessionFunction({
                description: "Check if pressure is ok",
                params: {
                    type: "object",
                    properties: {
                        pressure: {
                            type: "number"
                        },
                    }
                },
                async handler(params: {pressure: number}) {
                    if (params.pressure < 8 || params.pressure > 10) {
                        const formData = new FormData();
                        formData.append('file', new Blob([data.file.buffer]), data.file.originalname);
                        formData.append('contentType', 'image');
                        formData.append('fileType', 'image/jpeg')
                        formData.append('name', data.file.originalname)
                        const answer = await axios.post(`${process.env.MANIFEST_API_URL}/graphql/v3?storage=manifest`, formData, {
                            headers: {
                                'Authorization': process.env.JWT_TOKEN,
                                'Accept': 'application/json'
                            }
                        })
                        const photoId = answer.data.id
                        const serverAnswer = await axios.post(`${process.env.MANIFEST_API_URL}/graphql/v3`,{
                            query: graphqlQueries.submitFault,
                            variables: {
                                "data": {
                                    "assetId": 1891,
                                    "description": "Coffee Machine fault",
                                    "notes": [
                                        {
                                            "title": "0001",
                                            "type": "photo",
                                            "order": 1,
                                            "text": "",
                                            "autoplay": false,
                                            "actionType": null,
                                            "meterRequirements": [],
                                            "files": [
                                                photoId
                                            ]
                                        },
                                        {
                                            "title": "Invalid Pressure",
                                            "type": "text",
                                            "order": 1,
                                            "text": "Pressure is out of range",
                                            "autoplay": false,
                                            "actionType": null,
                                            "meterRequirements": [],
                                            "files": []
                                        }
                                    ]
                                }
                            }
                        }, {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': process.env.JWT_TOKEN
                            }
                        })
                        console.log(serverAnswer.data)
                        return `pressure is out of range`;
                    } else {
                        return 'pressure is good'
                    }
                }
            }),
        };
        console.log("User: " + data.prompt);

        const a1 = await session.prompt(data.prompt, {functions, temperature: 0.1});
        console.log("AI: " + a1);
        return a1
    }
}
