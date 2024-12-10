import {Injectable, OnApplicationBootstrap} from "@nestjs/common";
import {HuggingFaceTransformersEmbeddings} from '@langchain/community/embeddings/hf_transformers';
import {FaissStore} from '@langchain/community/vectorstores/faiss';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import * as fs from "fs";
import {getLlmAnswer, getTestLlmAnswer, getTextTranslation} from "./api/llmApi";
import {sharedData} from "./sharedData";

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

@Injectable()
export class TaqiChatService implements OnApplicationBootstrap {
    hashRegex = /(^|\s)(#[a-z+=\d-]+)/ig

    vectorStores: { vectorStore: FaissStore, userId: String }[] = [];
    embeddingModel = new HuggingFaceTransformersEmbeddings();
    filesTempDirectory = `./src/taqiChat/`;
    url = "https://pleasant-bluejay-next.ngrok-free.app/makerDocker/completion"

    async onApplicationBootstrap() {
        //await this.generateBlob()
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
        if (currentUserVectorStore) {
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
        file: Express.Multer.File,
    ) {
        console.log("fileProcessing")
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 0,
        });
        const filePath = `${this.filesTempDirectory}temp/file.pdf`;
        fs.writeFileSync(filePath, file.buffer);
        let fileLoader: PDFLoader = new PDFLoader(filePath);
        const documents = await fileLoader.load();
        const splittedDocs = await textSplitter.splitDocuments(documents);
        const fileVectorFormat = await FaissStore.fromDocuments(
            splittedDocs,
            this.embeddingModel,
        );
        const currentUserVectorStore = this.vectorStores.find(el => el.userId === userId)
        if (currentUserVectorStore) {
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
        console.log("success")
        fs.unlinkSync(filePath);
    }

    async generateAnswer(
        data: {
            userId: string,
            template?: string,
            question: string,
            dropContext?: boolean,
            chatHistory?: IChatMessage[],
            files?: Express.Multer.File[],
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
            console.log(data.template)
            const parsedTemplate = JSON.parse(data.template) as ITemplate
            for (const step of parsedTemplate.steps) {
                for (const note of step.notes) {
                    if (note.text) {
                        await this.processText(data.userId, note.text)
                    }
                    if (data.files && data.files.length && note.files && note.files.length) {
                        for (const file of data.files) {
                               await this.processFile(data.userId, file)
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
${usedHashtags.find(el => el === '#manifest') && `Use this FAQ information to lead user how to use manifest
----------
#FAQ information:
${sharedData.faq}
----------`}
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
        } else {
            let searchResult
            if (usedHashtags.find(el => el.includes('lang='))) {
                const questionTranslate = await getTextTranslation(data.question.replace("#dropcontext", ""))
                searchResult = await currentUserContext.vectorStore.similaritySearch(questionTranslate, 20)
            } else {
                searchResult = await currentUserContext.vectorStore.similaritySearch(data.question.replace("#dropcontext", ""), 20)
            }
            const extraInfo = searchResult.reduce((acc, el) => acc + el.pageContent + " ", "")
            console.log(extraInfo)
            const prompt = `<s>[INST]Your name is Taqi - part of Taqtile Manifest team, this is common information about your products:
----------
#Common information:
${sharedData.commonInformation}
----------
You are smart assistant. Act like a real human, do not let user know that you are artificial intelligence. Try to answer user's question
----------
#Question:
${finalQuestion}
----------
${usedHashtags.find(el => el === '#manifest') && `Use this FAQ information to lead user how to use manifest
----------
#FAQ information:
${sharedData.faq}
----------`}
Check if information below is related to the question, if yes use additional information provided below to answer question, if it is not related just say that you do not know how to answer user's question
----------
#Additional information:
${extraInfo}
----------
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
}
