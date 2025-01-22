import axios from "axios";

export const getLlmAnswer = async (prompt: string) => {
    const answer = await axios.post(`${process.env.MODEL_URL}/completion`, {
        prompt,
        seed: -1,
        temperature: 0.1
    })
    return answer
}

export const getTestLlmAnswer = async () => {
    const answer = await axios.get(`${process.env.MODEL_URL}/health`)
    return answer
}

export const getTextTranslation = async (text: string) => {
    const answer = await axios.post(`${process.env.MODEL_URL}/completion`, {
        prompt: `[INST]Translate this text to english: ${text}[/INST]`,
        grammar: "root ::= Translate\nTranslate ::= \"{\"   ws   \"\\\"translation\\\":\"   ws   string   \"}\"\nstring ::= \"\\\"\"   ([^\"]*)   \"\\\"\"\nboolean ::= \"true\" | \"false\"\nws ::= [ \\t\\n]*\nnumber ::= [0-9]*\nstringlist ::= \"[\"   ws   \"]\" | \"[\"   ws   string   (\",\"   ws   string)*   ws   \"]\"\nnumberlist ::= \"[\"   ws   \"]\" | \"[\"   ws   string   (\",\"   ws   number)*   ws   \"]\""
    })
    return JSON.parse(answer.data.content).translation
}

