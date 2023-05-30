import type { Context, Service, ServiceSchema } from "moleculer";
import type { DbAdapter, DbServiceSettings, MoleculerDbMethods } from "moleculer-db";
import type MongoDbAdapter from "moleculer-db-adapter-mongo";

import { scheduleJob } from "node-schedule";

import { CommonIdentifier } from "data-import-wizard-utils";
import type { DbServiceMethods } from "../mixins/db.mixin";
import DbMixin from "../mixins/db.mixin";

interface Organisation extends CommonIdentifier {
	path: string;
	// parent: Organisation;
}

export interface ScheduleEntity {
	_id: string;
	mapping: string;
	dhis2URL: string;
	type: string;
	username: string;
	password: string;
	authenticationType: "basic" | "access_token";
}

export type ActionCreateParams = Partial<ScheduleEntity>;

interface ScheduleSettings extends DbServiceSettings {
	indexes?: Record<string, number>[];
}

interface ScheduleThis extends Service<ScheduleSettings>, MoleculerDbMethods {
	adapter: DbAdapter | MongoDbAdapter;
}

const ScheduleService: ServiceSchema<ScheduleSettings> & { methods: DbServiceMethods } = {
	name: "schedules",
	// version: 1

	/**
	 * Mixins
	 */
	mixins: [DbMixin("schedules")],

	/**
	 * Settings
	 */
	settings: {
		// Available fields in the responses
		fields: [
			"_id",
			"mapping",
			"dhis2URL",
			"type",
			"username",
			"password",
			"authenticationType",
		],

		// Validator for the `create` & `insert` actions.
		entityValidator: {
			mapping: "string|min:11",
			dhis2URL: "string|required",
		},

		indexes: [{ mapping: 1 }],
	},

	/**
	 * Action Hooks
	 */
	hooks: {
		before: {},
		after: {
			create(ctx: Context<ActionCreateParams>) {
				console.log(ctx.params);
			},
			update() {},
		},
	},

	/**
	 * Actions
	 */
	actions: {},

	/**
	 * Methods
	 */
	methods: {
		// async seedDB(this: ScheduleThis) {
		// await this.adapter.insertMany([
		// 	{ name: "Samsung Galaxy S10 Plus", quantity: 10, price: 704 },
		// 	{ name: "iPhone 11 Pro", quantity: 25, price: 999 },
		// 	{ name: "Huawei P30 Pro", quantity: 15, price: 679 },
		// ]);
		// },
	},

	async afterConnected(this: ScheduleThis) {
		scheduleJob("*/5 * * * * *", async () => {
			// await syncTrackedEntityInstances();
		});
		// const data = await this.adapter.find({});
		// for (const m of data) {
		// 	const los: ScheduleEntity = m as ScheduleEntity;
		// 	// if(los.type === "program"){}
		// 	processProgramMapping(los);
		// }
		// if ("collection" in this.adapter) {
		// 	if (this.settings.indexes) {
		// 		await Promise.all(
		// 			this.settings.indexes.map((index) =>
		// 				(<MongoDbAdapter>this.adapter).collection.createIndex(index),
		// 			),
		// 		);
		// 	}
		// }
	},
};

export default ScheduleService;
