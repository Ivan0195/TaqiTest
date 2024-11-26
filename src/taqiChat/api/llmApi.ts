import axios from "axios";

export const getLlmAnswer = async (prompt: string) => {
    const answer = await axios.post("https://pleasant-bluejay-next.ngrok-free.app/makerDocker/completion", {
        prompt,
        seed: -1
    })
    return answer
}