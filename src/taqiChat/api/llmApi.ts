import axios from "axios";

export const getLlmAnswer = async (prompt: string) => {
    const answer = await axios.post(`${process.env.MODEL_URL}/completion`, {
        prompt,
        seed: -1,
        temperature: 0.1
    })
    return answer
}

export const getFollowUpGuide = async (prompt: string) => {
    const answer = await axios.post(`${process.env.MODEL_URL}/completion`, {
        prompt,
        grammar: "root ::= Template\nStep ::= \"{\"   ws   \"\\\"step_content\\\":\"   ws   string   \"}\"\nSteplist ::= \"[]\" | \"[\"   ws   Step   (\",\"   ws   Step)*   \"]\"\nTemplate ::= \"{\"   ws   \"\\\"opening\\\":\"   ws   string   \",\"   ws   \"\\\"step_by_step_guide\\\":\"   ws   Steplist   \"}\"\nTemplatelist ::= \"[]\" | \"[\"   ws   Template   (\",\"   ws   Template)*   \"]\"\nstring ::= \"\\\"\"   ([^\"]*)   \"\\\"\"\nboolean ::= \"true\" | \"false\"\nws ::= [ \\t\\n]*\nnumber ::= [0-9]*\nstringlist ::= \"[\"   ws   \"]\" | \"[\"   ws   string   (\",\"   ws   string)*   ws   \"]\"\nnumberlist ::= \"[\"   ws   \"]\" | \"[\"   ws   string   (\",\"   ws   number)*   ws   \"]\"",
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
        prompt: `[INST]detect the language and translate this text to english: "${text}". Return only translated text and detected language name[/INST]`,
        grammar:  "root ::= Translate\nTranslate ::= \"{\"   ws   \"\\\"translation\\\":\"   ws   string   \",\"   ws   \"\\\"detected_language_full_name\\\":\"   ws   string   \"}\"\nstring ::= \"\\\"\"   ([^\"]*)   \"\\\"\"\nboolean ::= \"true\" | \"false\"\nws ::= [ \\t\\n]*\nnumber ::= [0-9]*\nstringlist ::= \"[\"   ws   \"]\" | \"[\"   ws   string   (\",\"   ws   string)*   ws   \"]\"\nnumberlist ::= \"[\"   ws   \"]\" | \"[\"   ws   string   (\",\"   ws   number)*   ws   \"]\"",
        temperature: 0.0
    })
    console.log(answer.data.content)
    return JSON.parse(answer.data.content)
}

