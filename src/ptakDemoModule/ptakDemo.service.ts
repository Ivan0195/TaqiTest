import {Injectable} from "@nestjs/common";
import axios from "axios";
import {graphqlQueries} from "../taqiChat/graphqlQueries";
import * as fs from "fs";


@Injectable()
export class PtakDemoService {
    filesTempDirectory = `./src/taqiChat/`;
    llama;
    getllama;
    llamaChatSession;
    manifestUrl = `${process.env.MANIFEST_API_URL}/graphql/v3?storage=manifest`

    // async uploadPhoto() {
    //     const data = new FormData();
    //
    //     data.append('file', fs.createReadStream('image2.jpg'));
    //     data.append('contentType', 'image');
    //
    //     const config = {
    //         method: 'post',
    //         maxBodyLength: Infinity,
    //         url: this.manifestUrl,
    //         headers: {
    //             'Authorization': process.env.JWT_TOKEN,
    //             'Accept': 'application/json'
    //         },
    //         data : data
    //     };
    //
    //     const fileId = await axios(config)
    //
    //     return fileId.data
    // }

    async checkForFault(prompt: string) {
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

       // const getPhotoId = this.uploadPhoto

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
                    if (params.pressure < 8 || params.pressure > 10) {

                        //const photoId = await getPhotoId()

                        const serverAnswer = await axios.post(`${process.env.MANIFEST_API_URL}/graphql/v3`,{
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
        console.log("User: " + prompt);

        const a1 = await session.prompt(prompt, {functions, temperature: 0.1});
        console.log("AI: " + a1);
        return a1
    }
}
