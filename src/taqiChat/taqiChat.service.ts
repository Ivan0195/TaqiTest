import {Injectable, OnApplicationBootstrap} from "@nestjs/common";
import {HuggingFaceTransformersEmbeddings} from '@langchain/community/embeddings/hf_transformers';
import {FaissStore} from '@langchain/community/vectorstores/faiss';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import * as fs from "fs";
import {getLlmAnswer} from "./api/llmApi";

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
    text: string;
    FileId: Blob
}

export interface IChatMessege {
    author: "taqi" | "user",
    messege: string
}

@Injectable()
export class TaqiChatService implements OnApplicationBootstrap {
    systemTags = ["#dropcontext"]

    vectorStores: {vectorStore: FaissStore, userId: String}[] = [];
    embeddingModel = new HuggingFaceTransformersEmbeddings();
    filesTempDirectory = `./src/taqiChat/`;
    url = "https://pleasant-bluejay-next.ngrok-free.app/makerDocker/completion"

    onApplicationBootstrap() {

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
        await fileVectorFormat.save(
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
            chatHistory?: IChatMessege[],
        }
    ) {
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
                    await this.processFile(data.userId, note.FileId)
                }
            }
        }
        const currentUserContext = this.vectorStores.find(el => el.userId === data.userId)
        if (!currentUserContext) {
            const prompt = `[INST]Your name is Taqi, you are smart assistant. Give Valid answer to provided question: ${data.question.replace("#dropcontext", "")}[/INST]`
            const answer = await getLlmAnswer(prompt)
            return answer.data
        } else {
            const searchResult = await currentUserContext.vectorStore.similaritySearch(data.question.replace("#dropcontext", ""), 20)
            const extraInfo = searchResult.reduce((acc, el) => acc + el.pageContent + " ", "")
            console.log(extraInfo)
            const prompt = `[INST]Your name is Taqi, you are smart assistant. Give Valid answer to provided question: ${data.question.replace("#dropcontext", "")}. Use this information to answer: ${extraInfo}[/INST]`
            const answer = await getLlmAnswer(prompt)
            return answer.data
        }
    }
}
