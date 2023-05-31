import type { Context, Service, ServiceSchema } from "moleculer";
export interface ActionHelloParams {
	name: string;
}

interface GreeterSettings {
	defaultName: string;
}

interface GreeterMethods {
	uppercase(str: string): string;
}

interface GreeterLocalVars {
	myVar: string;
}

type GreeterThis = Service<GreeterSettings> & GreeterMethods & GreeterLocalVars;

const GreeterService: ServiceSchema<GreeterSettings> = {
	name: "greeter",
	settings: {
		defaultName: "Moleculer",
	},
	dependencies: [],

	actions: {
		hello: {
			rest: {
				method: "GET",
				path: "/hello",
			},
			handler(this: GreeterThis /* , ctx: Context */) {
				return `Hello ${this.settings.defaultName}`;
			},
		},

		welcome: {
			rest: "GET /welcome/:name",
			params: {
				name: "string",
			},
			handler(this: GreeterThis, ctx: Context<ActionHelloParams>) {
				return `Welcome, ${ctx.params.name}`;
			},
		},
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {},

	/**
	 * Service created lifecycle event handler
	 */
	created() {},

	/**
	 * Service started lifecycle event handler
	 */
	started: async () => {
		// let params = new URLSearchParams();
		// const api = axios.create({
		// 	baseURL: "https://ugandaeidsr.org/api",
		// 	auth: {
		// 		username: "Charles.Olupot",
		// 		password: "Dhis@2020",
		// 	},
		// 	params,
		// });
		// const job = scheduleJob("*/5 * * * * *", () => {
		// 	console.log("The answer to life, the universe, and everything!");
		// });
		// return undefined;
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {},
};

export default GreeterService;
