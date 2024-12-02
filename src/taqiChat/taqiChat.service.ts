import {Injectable, OnApplicationBootstrap} from "@nestjs/common";
import {HuggingFaceTransformersEmbeddings} from '@langchain/community/embeddings/hf_transformers';
import {FaissStore} from '@langchain/community/vectorstores/faiss';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import * as fs from "fs";
import {getLlmAnswer, getTestLlmAnswer} from "./api/llmApi";
import {sharedData} from "./sharedData";

export interface ITemplate {
    id: number;
    title: string;
    assetClass: IAssetClass;
    steps: IStep[];
}
interface IAssetClass {
name: string;
description: string;
}
interface IStep {
title: string;
step: number;
notes: INote[];
}
interface INote {
    type: 'text' | 'doc';
    title: string;
    text?: string;
    FileId?: Blob
}

export interface IChatMessage {
    author: "taqi" | "user",
    message: string
}

@Injectable()
export class TaqiChatService implements OnApplicationBootstrap {
    hashRegex = /(^|\s)(#[a-z+=\d-]+)/ig

    vectorStores: {vectorStore: FaissStore, userId: String}[] = [];
    embeddingModel = new HuggingFaceTransformersEmbeddings();
    filesTempDirectory = `./src/taqiChat/`;
    url = "https://pleasant-bluejay-next.ngrok-free.app/makerDocker/completion"

    async onApplicationBootstrap() {
        //await this.generateBlob()
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
    //
    // async generateBlob() {
    //     const textSplitter = new RecursiveCharacterTextSplitter({
    //         chunkSize: 512,
    //         chunkOverlap: 0,
    //     });
    //     const buffer = fs.readFileSync(`${this.filesTempDirectory}temp/sst1800.pdf`)
    //     const blob = new Blob([buffer], {type: "application/pdf"})
    //     const blobBuffer = await blob.arrayBuffer()
    //     const filePath = `${this.filesTempDirectory}temp/file.pdf`;
    //     fs.writeFileSync(filePath, Buffer.from(blobBuffer));
    //     let fileLoader: PDFLoader = new PDFLoader(filePath);
    //     const documents = await fileLoader.load();
    //     const splittedDocs = await textSplitter.splitDocuments(documents);
    //     const fileVectorFormat = await FaissStore.fromDocuments(
    //         splittedDocs,
    //         this.embeddingModel,
    //     );
    //     const currentUserVectorStore = this.vectorStores.find(el => el.userId === "1")
    //     if (currentUserVectorStore) {
    //         await currentUserVectorStore.vectorStore.mergeFrom(fileVectorFormat)
    //         await currentUserVectorStore.vectorStore.save(
    //             `${this.filesTempDirectory}vectorStores/1`,
    //         );
    //     } else {
    //         this.vectorStores.push({
    //             userId: "1",
    //             vectorStore: fileVectorFormat
    //         })
    //         await fileVectorFormat.save(
    //             `${this.filesTempDirectory}vectorStores/1`,
    //         );
    //     }
    //     fs.unlinkSync(filePath);
    // }

    async processText (userId: string, text: string) {
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
        await currentUserVectorStore.vectorStore.save(
            `${this.filesTempDirectory}vectorStores/${userId}`,
        );
    }

    async processFile(
        userId: string,
        file: Blob,
    ) {
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 0,
        });
        const blobBuffer = await file.arrayBuffer()
        const filePath = `${this.filesTempDirectory}temp/file.pdf`;
        fs.writeFileSync(filePath, Buffer.from(blobBuffer));
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
        await currentUserVectorStore.vectorStore.save(
            `${this.filesTempDirectory}vectorStores/${userId}`,
        );
        fs.unlinkSync(filePath);
    }

    async generateAnswer(
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
        if (usedHashtags) {
            languageToUse = usedHashtags.find(el => el.includes("lang="))
        }
        if (data.dropContext || data.question.includes("#dropcontext") || data.template) {
            const index = this.vectorStores.indexOf(this.vectorStores.find(el => el.userId === data.userId));
            if (index !== -1) {
                this.vectorStores.splice(index, 1);
                const filePath = `${this.filesTempDirectory}vectorStores/${data.userId}`
                fs.rmSync(filePath, { recursive: true, force: true });
            }
        }
        if (data.template) {
            for (const step of data.template.steps) {
                for (const note of step.notes) {
                    if (note.type === "doc") {
                        await this.processFile(data.userId, note.FileId)
                    } else {
                        await this.processText(data.userId, note.text)
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
#Questiom:
${finalQuestion}
----------
${data.chatHistory ? `Use previous chat history:
----------
#Chat history:
${data.chatHistory.map((el) => {
                return `${el.author === "user" ? `User: ${el.message}\n` : `Taqi: ${el.message}\n`}`}).reduce((acc, el) => acc + el, "")}----------` : ''}
${languageToUse ? `Always answer in ${languageToUse.split('=')[1]} language` : ''}
[/INST]`
            const answer = await getLlmAnswer(prompt)
            return answer.data.content
        } else {
            const searchResult = await currentUserContext.vectorStore.similaritySearch(data.question.replace("#dropcontext", ""), 20)
            const extraInfo = searchResult.reduce((acc, el) => acc + el.pageContent + " ", "")
            console.log(extraInfo)
            const prompt = `<s>[INST]Your name is Taqi - part of Manifest team, this is common information about your products:
----------
#Common information:
${sharedData.commonInformation}
----------
You are smart assistant. Act like a real human, do not let user know that you are artificial intelligence. Answer user's question
----------
#Question:
${finalQuestion}
----------
Use additional information, which can help you to generate correct answer
----------
#Additional information:
${extraInfo}
----------
${data.chatHistory ? `Use previous chat history:
----------
#Chat history:
${data.chatHistory.map((el) => {
                return `${el.author === "user" ? `User: ${el.message}\n` : `Taqi: ${el.message}\n`}`}).reduce((acc, el) => acc + el, "")}----------` : ''}
[/INST]`
            const answer = await getLlmAnswer(prompt)
            return answer.data.content
        }
    }

    async testTaqi () {
        const answer = await getTestLlmAnswer()
        return answer.data.status
    }
}
