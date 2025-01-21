import {Injectable} from "@nestjs/common";
import { RecursiveUrlLoader } from "@langchain/community/document_loaders/web/recursive_url";
import { compile } from "html-to-text";
import axios from "axios";
import {graphqlQueries} from "../taqiChat/graphqlQueries";


@Injectable()
export class PtakDemoService {
    filesTempDirectory = `./src/taqiChat/`;
    llama;
    getllama;
    llamaChatSession;
    jwt = "JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTY3LCJzdWJkb21haW4iOiJ0ZXN0IiwiZGV2aWNlSWQiOm51bGwsImp0aSI6IiQyYiQxMCRzWC52eUlINFQwQ2tvd3BwejBRMlZlcEk4WmQ2cmljRTUzTjllczZRNy5XTkJJTkhOSVplTyIsImlhdCI6MTczNjkzNzcyMSwiZXhwIjoxNzM5NTI5NzIxfQ.kS_PDlhGo5rO_6lMkohMVtcYwKvDChp1TyUSSgCVGPc"

    async checkForFault() {
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
                    console.log(params)
                    if (params.pressure < 1 || params.pressure > 5) {
                        const serverAnswer = await axios.post("http://192.168.1.120:85/graphql/v3",{
                            query: `mutation($data: FaultInput!) {addFault(data: $data)}`,
                            variables: {
                                "data": {
                                    "assetId": 1891,
                                    "description": "Coffee Machine fault",
                                    "notes": [
                                        // {
                                        //     "title": "0001",
                                        //     "type": "photo",
                                        //     "order": 1,
                                        //     "text": "",
                                        //     "autoplay": false,
                                        //     "actionType": null,
                                        //     "meterRequirements": [],
                                        //     "files": [
                                        //         'id'
                                        //     ]
                                        // },
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
                                'Authorization': graphqlQueries.jwt
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
        const q1 = "check if pressure '10' is ok";
        console.log("User: " + q1);

        const a1 = await session.prompt(q1, {functions, temperature: 0.1});
        console.log("AI: " + a1);
        return a1
    }
}
