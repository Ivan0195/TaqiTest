import {Injectable, OnApplicationBootstrap} from "@nestjs/common";
import {HuggingFaceTransformersEmbeddings} from '@langchain/community/embeddings/hf_transformers';
import {FaissStore} from '@langchain/community/vectorstores/faiss';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import * as fs from "fs";
import {getFollowUpGuide, getLlmAnswer, getTestLlmAnswer, getTextTranslation} from "./api/llmApi";
import {sharedData} from "./sharedData";
import {PDFDocument} from "pdf-lib";
import {Document} from "@langchain/core/documents";

export interface ITemplate {
    id: number,
    title: string,
    assetClass: IAssetClass,
    steps: IStep[],
}

interface IAssetClass {
    name: string,
    description: string,
}

interface IStep {
    title: string,
    step: number,
    notes: INote[],
}

interface INote {
    type: 'text' | 'doc',
    title: string,
    text?: string,
    files: INoteFile[]
}

export interface IChatMessage {
    author: "taqi" | "user",
    message: string
}

export interface IFile {
    id: number,
    blob: Buffer
}

interface INoteFile {
    id?: number,
    name?: string,
    url?: string,
    isDefault?: boolean | null,
    fileType?: string,
    contentType?: string,
    entityType?: string,
    originalName?: string,
}

interface IFollowUpGuide {
    opening: string,
    step_by_step_guide: {
        step_content: string
    }[]
}

interface IUserGuideData {
    userId: string,
    guide: IFollowUpGuide,
    currentStep: number
}

@Injectable()
export class TaqiChatService implements OnApplicationBootstrap {
    hashRegex = /(^|\s)(#[a-z+=\d-]+)/ig

    vectorStores: { vectorStore: FaissStore, userId: String }[] = [];
    embeddingModel = new HuggingFaceTransformersEmbeddings();
    filesTempDirectory = `./src/taqiChat/`;
    isFollowUpActive = false
    usersCurrentGuides: IUserGuideData[] = []
    followUpStartKeywords = ["instruction", "guide", "step-by-step", "step by step", "follow-up", "follow up"]
    nextStepKeywords = ["next"]

    // llama;
    // getllama;
    // llamaChatSession;
    // model;

    async onApplicationBootstrap() {
        //await this.functionCallingTest()
        // const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
        // this.getllama = getLlama;
        // this.llamaChatSession = LlamaChatSession;
        // this.llama = await this.getllama();
        const buffer = fs.readFileSync(`${this.filesTempDirectory}temp/tmp.txt`).toString('utf-8')
        const filePath = `${this.filesTempDirectory}temp/file.pdf`;
        fs.writeFileSync(filePath, Buffer.from(buffer));
        const cachedStores = fs.readdirSync(`${this.filesTempDirectory}vectorStores`)
        for (let folder of cachedStores) {
            try {
                const store = await FaissStore.load(`${this.filesTempDirectory}vectorStores/${folder}`, this.embeddingModel)
                this.vectorStores.push({userId: folder, vectorStore: store})
            } catch {
                console.log("No cached data in provided folder")
            }
        }
    }



    async processText(userId: string, text: string) {
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 0,
        });
        const splittedText = await textSplitter.splitText(text);
        const textVectorFormat = await FaissStore.fromTexts(splittedText, [], this.embeddingModel)
        const currentUserVectorStore = this.vectorStores.find(el => el.userId === userId)
        if (currentUserVectorStore && currentUserVectorStore.vectorStore) {
            await currentUserVectorStore.vectorStore.mergeFrom(textVectorFormat)
        } else {
            this.vectorStores.push({
                userId: userId,
                vectorStore: textVectorFormat
            })
        }
        await this.vectorStores.find(el => el.userId === userId).vectorStore.save(
            `${this.filesTempDirectory}vectorStores/${userId}`,
        );
    }

    async processFile(
        userId: string,
        filePath: string,
    ) {
        let fileLoader: PDFLoader = new PDFLoader(filePath);
        const splittedDocs: Document[] = await fileLoader.load()
        console.log(splittedDocs.length)
        const fileVectorFormat = await FaissStore.fromDocuments(
            splittedDocs,
            this.embeddingModel,
        );
        const currentUserVectorStore = this.vectorStores.find(el => el.userId === userId)
        if (currentUserVectorStore && currentUserVectorStore.vectorStore) {
            await currentUserVectorStore.vectorStore.mergeFrom(fileVectorFormat)
        } else {
            this.vectorStores.push({
                userId: userId,
                vectorStore: fileVectorFormat
            })
        }
        await this.vectorStores.find(el => el.userId === userId).vectorStore.save(
            `${this.filesTempDirectory}vectorStores/${userId}`,
        );
    }

    async generateAnswer (
        data: {
            userId: string,
            template?: string,
            question: string,
            dropContext?: boolean,
            chatHistory?: string,
            files?: Express.Multer.File[],
        }
    ) {
        console.log("generating answer")
        //Check if user asking for a next step for previously generated guide
        if (this.isFollowUpActive) {
            console.log("guide is active")
            let isAskingForNextStep = false
            for (const keyword of this.nextStepKeywords) {
                if(data.question.includes(keyword)) {
                    isAskingForNextStep = true
                    break
                }
            }
            if (isAskingForNextStep) {
                console.log("nest step please")
                const currentUserIndex = this.usersCurrentGuides.findIndex(el => el.userId === data.userId)
                if (currentUserIndex >= 0) {
                    console.log(this.usersCurrentGuides[currentUserIndex].guide)
                    const answer = this.usersCurrentGuides[currentUserIndex].guide.step_by_step_guide[this.usersCurrentGuides[currentUserIndex].currentStep].step_content
                    console.log(answer)
                    this.usersCurrentGuides[currentUserIndex].currentStep += 1
                    if (this.usersCurrentGuides[currentUserIndex].currentStep === this.usersCurrentGuides[currentUserIndex].guide.step_by_step_guide.length) {
                        this.isFollowUpActive = false
                    }
                    return answer
                }
            } else {
                this.isFollowUpActive = false
            }
        } else {
            console.log("guide is inactive")
            const currentUserIndex = this.usersCurrentGuides.findIndex(el => el.userId === data.userId)
            for (const keyword of this.followUpStartKeywords) {
                if (data.question.includes(keyword)) {
                    console.log("user ask for guide")
                    this.isFollowUpActive = true
                    const guideData = await this.getLLMAnswer({...data, generateGuide: true})
                    if (currentUserIndex < 0) {
                        this.usersCurrentGuides.push({
                            userId: data.userId,
                            currentStep: 0,
                            guide: guideData
                        })
                    } else {
                        console.log("users's guide exist")
                        this.usersCurrentGuides[currentUserIndex] = {
                            userId: data.userId,
                            currentStep: 0,
                            guide: guideData
                        }
                        console.log(this.usersCurrentGuides[currentUserIndex].guide)
                    }
                    this.isFollowUpActive = true
                    return guideData.opening
                }
            }
            if (!this.isFollowUpActive) {
                return await this.getLLMAnswer(data)
            }
        }
    }

    async getLLMAnswer(
        data: {
            userId: string,
            template?: string,
            question: string,
            dropContext?: boolean,
            chatHistory?: string,
            files?: Express.Multer.File[],
            generateGuide?: boolean
        }
    ) {
        if (!data.chatHistory || !data.chatHistory.length) {
            return 'Hi, I\'m TAQi, AI assistant, please tell me what template you are currently working with, provide the number in the format #templateId=123456. '
        }
        let languageToUse
        let finalQuestion = data.question
        const usedHashtags: string[] = data.question.match(this.hashRegex)
        if (usedHashtags) {
            usedHashtags.forEach(el => {
                finalQuestion = finalQuestion.replace(el, "")
            })
        }
        if (usedHashtags && usedHashtags.includes("#autotest")) {
            return this.testTaqi()
        }
        if (usedHashtags) {
            languageToUse = usedHashtags.find(el => el.includes("lang="))
        }
        if (data.dropContext || data.question.includes("#dropcontext") || data.template) {
            const index = this.vectorStores.indexOf(this.vectorStores.find(el => el.userId === data.userId));
            if (index !== -1) {
                this.vectorStores.splice(index, 1);
                const filePath = `${this.filesTempDirectory}vectorStores/${data.userId}`
                fs.rmSync(filePath, {recursive: true, force: true});
            }
        }
        if (data.template) {
            const currentUserVectorStore = this.vectorStores.find(el => el.userId === data.userId)
            if (currentUserVectorStore) {
                currentUserVectorStore.vectorStore = null
            }
            const parsedTemplate = JSON.parse(data.template) as ITemplate
            if (data.files && data.files.length) {
                console.log("found doc")
                const mergedPdf = await PDFDocument.create();
                for (const file of data.files) {
                    const pdf = await PDFDocument.load(file.buffer);
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => {
                        mergedPdf.addPage(page);
                    });
                }
                const filePath = `${this.filesTempDirectory}temp/merged_file.pdf`;
                const bytes = await mergedPdf.save()
                fs.writeFileSync(filePath, bytes);
                await this.processFile(data.userId, filePath)
            }
            if (parsedTemplate.steps && parsedTemplate.steps.length) {
                for (const step of parsedTemplate.steps) {
                    await this.processText(data.userId, step.title)
                    for (const note of step.notes) {
                        if (note.text) {
                            await this.processText(data.userId, note.text)
                        }
                    }
                }
            }
        }
        const currentUserContext = this.vectorStores.find(el => el.userId === data.userId)
        if (!currentUserContext) {
            const prompt = `<s>[INST]Your name is Taqi - part of Manifest team, if user's question is connected with Manifest or other Taqtile products use this information:
----------
#Common information:
${sharedData.commonInformation}
----------
You are smart assistant. Act like a real human, do not let user know that you are artificial intelligence. Answer user's question
----------
#Question:
${finalQuestion}
----------
${(usedHashtags && usedHashtags.includes('#manifest')) ? `Use this FAQ information to lead user how to use manifest
----------
#FAQ information:
${sharedData.faq}
----------` : ``}
${false ? `Use previous chat history:
----------
#Chat history:
${JSON.parse(data.chatHistory).map((el) => {
                return `${el.author === "user" ? `User: ${el.message}\n` : `Taqi: ${el.message}\n`}`
            }).reduce((acc, el) => acc + el, "")}----------` : ''}
${languageToUse ? `Always answer in ${languageToUse.split('=')[1]} language` : ''}
[/INST]`
            if (data.generateGuide) {
                const generatedData = await getFollowUpGuide(prompt)
                const guide = JSON.parse(generatedData.data.content) as IFollowUpGuide
                return guide
            } else {
                const answer = await getLlmAnswer(prompt)
                return answer.data.content
            }
        } else {
            let searchResult
            if (usedHashtags && usedHashtags.find(el => el.includes('lang='))) {
                const questionTranslate = await getTextTranslation(data.question.replace("#dropcontext", ""))
                searchResult = await currentUserContext.vectorStore.similaritySearch(questionTranslate, 20)
            } else {
                searchResult = await currentUserContext.vectorStore.similaritySearch(data.question.replace("#dropcontext", ""), 20)
            }
            const extraInfo = searchResult.reduce((acc, el) => acc + el.pageContent + " ", "")
            const prompt = `<s>[INST]Your name is Taqi - part of Taqtile Manifest team.${sharedData.commonInformation}
            ----------
            You are smart assistant. Act like a real human, do not let user know that you are artificial intelligence. Try to answer user's question
            ----------
            #Question:
            ${finalQuestion}
            ----------
            ${(usedHashtags && usedHashtags.includes('#manifest')) ? `Use this FAQ information to lead user how to use manifest
            ----------
            #FAQ information:
            ${sharedData.faq}
            ----------` : ``}
            ${false ? `Use previous chat history:
            ----------
            #Chat history:
            ${JSON.parse(data.chatHistory).map((el) => {
                return `${el.author === "user" ? `User: ${el.message}\n` : `Taqi: ${el.message}\n`}`
            }).reduce((acc, el) => acc + el, "")}----------` : ''}
            ${languageToUse ? `Always answer in ${languageToUse.split('=')[1]} language` : ''}
            
            Check if information below is related to the question, if yes use additional information provided below to answer question, if it is not related just say that you do not know how to answer user's question
            ----------
            #Additional information:
            ${extraInfo}
            ----------
            Do not use any general information to answer the question
            [/INST]`
            if (data.generateGuide) {
                const generatedData = await getFollowUpGuide(prompt)
                const guide = JSON.parse(generatedData.data.content) as IFollowUpGuide
                return guide
            } else {
                const answer = await getLlmAnswer(prompt)
                return answer.data.content
            }
        }
    }

    async tipsTest(
        data: {
            userId: string,
            template?: ITemplate,
            question: string,
            dropContext?: boolean,
            chatHistory?: IChatMessage[],
        }
    ) {
        let languageToUse
        let finalQuestion = data.question
        const usedHashtags = data.question.match(this.hashRegex)
        if (usedHashtags) {
            usedHashtags.forEach(el => {
                finalQuestion = finalQuestion.replace(el, "")
            })
        }
        const prompt = `<s>[INST]
----------
#Question:
${finalQuestion}
----------
Check if information below is related to the question 
----------
#Additional information:
How to remove the steel insert from the table
Before starting work, make sure that the circular saw is unplugged (remove the plug from the socket). Always wear protective gloves to avoid injuring your hands during the operation. Set the saw blade to the maximum cutting depth. .
Set it to position 00 and lock it.
To remove the steel insert from the table, find the circular hole with a diameter of 4 cm on the steel insert.Iinsert your index finger into this hole, and pull the steel insert upward at an angle of approximately 30 degrees (until it stops) using your index finger.
Insert your index finger into this hole, and pull the steel insert upward at an angle of approximately 30 degrees (until it stops) using your index finger.
Once the blade is lifted halfway, pull the blade towards you to release the tabs from the grooves.
----------
it question is not related to additional information do not give any instructions and just say that you dont know, if yes answer question only using additional information
${data.chatHistory ? `Use previous chat history:
----------
#Chat history:
${data.chatHistory.map((el) => {
            return `${el.author === "user" ? `User: ${el.message}\n` : `Taqi: ${el.message}\n`}`
        }).reduce((acc, el) => acc + el, "")}----------` : ''}
${languageToUse ? `Always answer in ${languageToUse.split('=')[1]} language` : ''}
[/INST]`
        const answer = await getLlmAnswer(prompt)
        return answer.data.content
    }

    async testTaqi() {
        const answer = await getTestLlmAnswer()
        return answer.data.status
    }

    // async functionCallingTest() {
    //     const {getLlama, LlamaChatSession, defineChatSessionFunction} = await import ("node-llama-cpp");
    //     const llama = await getLlama();
    //     const model = await llama.loadModel({
    //         modelPath: `${this.filesTempDirectory}temp/Qwen2-VL-7B-Instruct-Q3_K_S.gguf`
    //     });
    //     const context = await model.createContext();
    //     const session = new LlamaChatSession({
    //         contextSequence: context.getSequence()
    //     });
    //
    //     const fruitPrices: Record<string, string> = {
    //         "apple": "$6",
    //         "banana": "$4"
    //     };
    //
    //     const functions = {
    //         getFruitPrice: defineChatSessionFunction({
    //             description: "Get the price of a fruit",
    //             params: {
    //                 type: "object",
    //                 properties: {
    //                     name: {
    //                         type: "string"
    //                     }
    //                 }
    //             },
    //             async handler(params: {name: string}) {
    //                 const name = params.name.toLowerCase();
    //                 if (Object.keys(fruitPrices).includes(name))
    //                     return {
    //                         name: name,
    //                         price: fruitPrices[name]
    //                     };
    //
    //                 return `Unrecognized fruit "${params.name}"`;
    //             }
    //         })
    //     };
    //     const q1 = "Is an apple more expensive than a banana?";
    //     console.log("User: " + q1);
    //
    //     const a1 = await session.prompt(q1, {functions});
    //     console.log("AI: " + a1);
    // }
}




