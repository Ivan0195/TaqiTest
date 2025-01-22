import {Injectable} from "@nestjs/common";
import { RecursiveUrlLoader } from "@langchain/community/document_loaders/web/recursive_url";
import { compile } from "html-to-text";
import axios from "axios";
import {graphqlQueries} from "../taqiChat/graphqlQueries";


@Injectable()
export class WebAssistService {
    filesTempDirectory = `./src/taqiChat/`;
    llama;
    getllama;
    llamaChatSession;

    async webSiteLoading(url: string) {

        const compiledConvert = compile({ wordwrap: 130 });
        const loader = new RecursiveUrlLoader("https://office.5scontrol.com/", {
            extractor: compiledConvert,
            maxDepth: 15,
            excludeDirs: ["/docs/api/"],
        });
        const docs = await loader.load();
        console.log(docs)
    }

    async handler(params: {email: string, password: string}) {
        const serverAnswer = await axios.post("http://192.168.1.120:85/rest/signin",{
            email: params.email,
            password: params.password
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        })
        console.log(serverAnswer.data.user.token)
        return `User authorized:  ${serverAnswer.data.user.token}"`;
    }

    async axiosGraphQL() {
        try {
            const data = await axios.post("http://192.168.1.120:85/graphql/v3", {
                query: graphqlQueries.getJobs,
                variables: {
                    pageNumber: 1,
                    itemsPerPage: 30,
                    filters: {
                        locationId: [],
                        priority: [],
                        assetId: [],
                        faultFlag: [],
                        assetClassId: [],
                        status: [
                            "Assigned",
                            "InProgress",
                            "Unassigned"
                        ],
                        assignedUserId: []
                    },
                    sort: {
                        propertyName: "id",
                        reverse: true
                    },
                    search: {},
                    orgId: []
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': process.env.JWT_TOKEN
                }
            })
            console.log(data.data.data)
            return data.data.data
        } catch (error) {
            console.log(error)
        }

    }

    async test() {
       return  await this.axiosGraphQL()
    }

    async functionCallingTest() {
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
            logInManifest: defineChatSessionFunction({
                description: "log in user into Manifest (authorization)",
                params: {
                    type: "object",
                    properties: {
                        email: {
                            type: "string"
                        },
                        password: {
                            type: "string"
                        },
                    }
                },
                async handler(params: {email: string, password: string}) {
                    console.log(params)
                    const serverAnswer = await axios.post("http://192.168.1.120:85/rest/signin",{
                        email: params.email,
                        password: params.password
                    }, {
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                    console.log(serverAnswer.data.user.token)
                    return `User authorized, token:  ${serverAnswer.data.user.token}"`;
                }
            }),
            getManifestUsers: defineChatSessionFunction({
                description: "Get list of Manifest users",
                params: {
                    type: "object",
                    properties: {
                        email: {
                            type: "string"
                        }
                    }
                },
                async handler(params: {email: string}) {
                    const data = await axios.post("http://192.168.1.120:85/graphql/v3", {
                        query: graphqlQueries.users,
                        variables: {
                            search: {},
                            filters: {
                                enabled: [
                                    true
                                ]
                            }
                        }
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': process.env.JWT_TOKEN
                        }
                    })
                    const array: Array<any> = data.data.data.users
                    array.length = 50
                    return array
                }
            }),
            findAssetClasses: defineChatSessionFunction({
                description: "Find asset classes in Manifest",
                params: {
                    type: "object",
                    properties: {
                        name: {
                            oneOf: [
                                {type: "string"},
                                {type: "null"}
                            ]
                        },
                        date_modified: {
                            oneOf: [
                                {type: "string"},
                                {type: "null"}
                            ]
                        },
                        status: {
                            oneOf: [
                                {type: "string"},
                                {type: "null"}
                            ]
                        },
                        orgs: {
                            oneOf: [
                                {type: "string"},
                                {type: "null"}
                            ]
                        },
                        id: {
                            oneOf: [
                                {type: "number"},
                                {type: "null"}
                            ]
                        },
                        description: {
                            oneOf: [
                                {type: "string"},
                                {type: "null"}
                            ]
                        }
                    }
                },
                async handler(params: {name?: string, date_modified?: string, status?: string, orgs?: string, id?: string, description?: string}) {
                    let newparams = {name: params.name ?? "", date_modified: params.date_modified ?? "", status: params.status ?? "", orgs: params.orgs ?? "", id: params.id ?? "", description: params.description ?? ""}
console.log(newparams)
                    const data = await axios.post("http://192.168.1.120:85/graphql/v3", {
                        query: graphqlQueries.assetClasses,
                        variables: {
                            "pageNumber": 1,
                            "itemsPerPage": 10,
                            "deleted": false,
                            "search": {
                                orgs: newparams.orgs,
                                name: newparams.name ?? "",
                                date_modified: newparams.date_modified ?? "",
                                description: newparams.description ?? "",
                                id: newparams.id ?? "",
                                status: newparams.status ?? ""
                            },
                            "orgId": [],
                            "filters": {
                            },
                            "sort": {
                                "propertyName": "name",
                                "reverse": false
                            }
                        }
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': process.env.JWT_TOKEN
                        }
                    })
                    console.log(data.data.data)
                    const array = data.data.data
                    return array
                }
            }),
            findTemplates: defineChatSessionFunction({
                description: "Find templates in Manifest",
                params: {
                    type: "object",
                    properties: {
                        filters: {
                            type: "object",
                            properties: {
                                assetClassId: {
                                    oneOf: [
                                        {
                                            type: "number"
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                },
                                type: {
                                    oneOf: [
                                        {
                                            enum: ['Operator', 'Inspector']
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                },
                                status: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                type: "string"
                                            }
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                }
                            }
                        },
                        search: {
                             type: "object",
                            properties: {
                                id: {
                                    oneOf: [
                                        {
                                            type: "number"
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                },
                                title: {
                                    oneOf: [
                                        {
                                            type: "string"
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                },
                                location: {
                                    oneOf: [
                                        {
                                            type: "string"
                                        }, {
                                            type: "null"
                                        }
                                    ]
                                },
                                job_type: {
                                    oneOf: [
                                        {
                                            type: "string"
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                },
                                status: {
                                    oneOf: [
                                        {
                                            type: "string"
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                },
                                ownerName: {
                                    oneOf: [
                                        {
                                            type: "string"
                                        },
                                        {
                                            type: "null"
                                        }
                                    ]
                                }
                            }
                        },
                    }
                },
                async handler(params: {
                    filters: {
                    assetClassId ? : number, type ? : "Operator" | "Inspector", status ? : string[]
                    },
                    search: {
                    id ? : number, title ? : string, location ? : string, job_type ? : string, status ? : string, ownerName ? : string
                    }
                }) {
                    // const serverAnswer = await axios.post("http://192.168.1.120:85/rest/signin",{
                    //     email: "manifestsupport@taqtile.com",
                    //     password: "324287"
                    // }, {
                    //     headers: {
                    //         "Content-Type": "application/json"
                    //     }
                    // })
                    // console.log(serverAnswer.data.user.token)
                    console.log(params)
                    try{
                        const data = await axios.post("http://192.168.1.120:85/graphql/v3", {
                            query: graphqlQueries.templates,
                            variables: {
                                "pageNumber": 1,
                                "itemsPerPage": 10,
                                "deleted": false,
                                "search": {
                                    title: params.search.title ?? "",
                                    location: params.search.location ?? "",
                                    job_type: params.search.job_type ?? "",
                                    status: params.search.status ?? "",
                                    ownerName: params.search.ownerName ?? "",

                                        ...(params.search.id && {id: params.search.id})
                                },
                                "orgId": [],
                                "filters": {
                                    assetClassId: params.filters.assetClassId ?? [],
                                    type: params.filters.type ?? [],
                                    status: params.filters.status ?? []
                                },
                                "sort": {
                                    "propertyName": "id",
                                    "reverse": true
                                }
                            }
                        }, {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': process.env.JWT_TOKEN
                            }
                        })
                        console.log(data.data.data)
                        const array = data.data.data
                        return array
                    } catch (err) {
                        console.log(err)
                    }

                }
            }),
            assignJobToUser: defineChatSessionFunction({
                description: "Assign job to user",
                params: {
                    type: "object",
                    properties: {
                        jobId: {
                            oneOf: [
                                {type: "number"},
                                {type: "null"}
                            ]
                        },
                        jobTitle: {
                            oneOf: [
                                {type: "string"},
                                {type: "null"}
                            ]
                        },
                        userId: {
                            oneOf: [
                                {type: "number"},
                                {type: "null"}
                            ]
                        },
                        userTitle: {
                            oneOf: [
                                {type: "string"},
                                {type: "null"}
                            ]
                        },
                    }
                },
                async handler(params: {email: string}) {
                    const data = await axios.post("http://192.168.1.120:85/graphql/v3", {
                        query: graphqlQueries.assignJobToUser,
                        variables: {
                            search: {},
                            filters: {
                                enabled: [
                                    true
                                ]
                            }
                        }
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': process.env.JWT_TOKEN
                        }
                    })
                    const array: Array<any> = data.data.data.users
                    array.length = 50
                    return array
                }
            }),
            findJobs: defineChatSessionFunction({
                description: "Find jobs data in Manifest",
                params: {
                    type: "object",
                    properties: {
                        filters: {
                            type: "object",
                            properties: {
                                locationID: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                type: "number"
                                            }
                                        },
                                        {type: "null"}
                                    ]
                                },
                                priority: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                enum: ["1", "2", "3"]
                                            }
                                        },
                                        {type: "null"}
                                    ]
                                },
                                assetId: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                type: "number"
                                            }
                                        },
                                        {type: "null"}
                                    ]
                                },
                                faultFlag: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                type: "boolean"
                                            }
                                        },
                                        {type: "null"}
                                    ]
                                },
                                assetClassId: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                type: "number"
                                            }
                                        },
                                        {type: "null"}
                                    ]
                                },
                                status: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {
                                                enum: ["Assigned", "InProgress", "Unassigned"]
                                            }
                                        },
                                        {type: "null"}
                                    ]

                                },
                                assignedUserId: {
                                    oneOf: [
                                        {
                                            type: "array",
                                            items: {type: "number"}
                                        },
                                        {type: "null"}
                                    ]
                                },
                            }
                        },
                        search: {
                            type: "object",
                            properties: {
                                id: {
                                    oneOf: [
                                        {type: "number"},
                                        {type: "null"}
                                    ]
                                },
                                title: {
                                    oneOf: [
                                        {type: "string"},
                                        {type: "null"}
                                    ]
                                }
                            }
                        }
                    }
                },
                async handler(params: {
                    filters: {
                        locationId?: number[],
                        priority?: Array<"1" | "2" | "3">,
                        assetId?: number[],
                        faultFlag?: boolean[],
                        assetClassId?: number[],
                        status?: Array<"Assigned" | "InProgress" | "Unassigned">,
                        assignedUserId?: number[],
                    },
                    search: {
                        id?: number,
                        title?: string
                    }
                }) {
                    console.log(params)
                    const data = await axios.post("http://192.168.1.120:85/graphql/v3", {
                        query: graphqlQueries.getJobs,
                        variables: {
                            pageNumber: 1,
                            itemsPerPage: 5,
                            filters: {
                                locationId: [],
                                priority: [],
                                assetId: [],
                                faultFlag: [],
                                assetClassId: [],
                                status: [
                                    "Assigned",
                                    "InProgress",
                                    "Unassigned"
                                ],
                                ...(params.filters.assignedUserId && {assignedUserId: params.filters.assignedUserId})
                            },
                            sort: {
                                propertyName: "id",
                                reverse: true
                            },
                            search: {

                            },
                            orgId: []
                        }
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': process.env.JWT_TOKEN
                        }
                    })
                    console.log(data.data.data)
                    const array: Array<any> = data.data.data
                    return array
                }
            }),
        };
        const q1 = "find jobs assigned to user with id 174";
        console.log("User: " + q1);

        const a1 = await session.prompt(q1, {functions, temperature: 0.1});
        console.log("AI: " + a1);
        return a1
    }

}
