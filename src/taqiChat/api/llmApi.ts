import axios from "axios";

export const getLlmAnswer = async (prompt: string) => {
    const answer = await axios.post("https://pleasant-bluejay-next.ngrok-free.app/makerDocker/completion", {
        prompt,
        seed: -1,
        temperature: 0.3
    })
    return answer
}

export const getTestLlmAnswer = async () => {
    const answer = await axios.get("https://pleasant-bluejay-next.ngrok-free.app/makerDocker/health")
    return answer
}