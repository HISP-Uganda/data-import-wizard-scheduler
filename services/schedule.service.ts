import axios from "axios";
import { writeFile } from "fs/promises";
import type { Context, Service, ServiceSchema } from "moleculer";
import { scheduleJob, scheduledJobs } from "node-schedule";

import { ISchedule } from "data-import-wizard-utils";
import dayjs from "dayjs";
import { processProgramMapping } from "./utils";

interface ScheduleSettings {}

interface ScheduleThis extends Service<ScheduleSettings> {}

interface Logins {
	[key: string]: { username: string; password: string; url: string };
}

const DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";

const write = async (schedule: ISchedule, update: Partial<ISchedule>) => {
	let schedules = (await import("./schedules.json")).default;

	const index = schedules.findIndex(({ id }) => id === schedule.id);

	if (index !== -1) {
		schedules[index] = { ...schedule, ...update };
	} else {
		schedules = [
			...schedules,
			{
				...schedule,
				...update,
			},
		];
	}
	await writeFile(`${__dirname}/schedules.json`, JSON.stringify(schedules));
};
const updateDHIS2 = async (schedule: ISchedule, update: Partial<ISchedule>) => {
	const dhis2 = (await import("./dhis2.json")).default;
	const allInstances = dhis2 as unknown as Logins;
	const scheduleDHIS2 = allInstances[schedule.id];

	if (scheduleDHIS2) {
		const api = axios.create({
			baseURL: scheduleDHIS2.url,
			auth: {
				username: scheduleDHIS2.username,
				password: scheduleDHIS2.password,
			},
		});
		const { data } = await api.put(
			`${scheduleDHIS2.url}dataStore/iw-schedules/${schedule.id}`,
			{
				...schedule,
				...update,
			},
		);
		return data;
	}
};
const createSchedule = async (schedule: ISchedule) => {
	return scheduleJob(schedule.id, schedule.schedule || "", async (fireDate: Date) => {
		const job = scheduledJobs[schedule.id];
		await updateDHIS2(schedule, {
			status: "running",
			nextRun: dayjs(job.nextInvocation()).format(DATE_FORMAT),
			lastRun: dayjs(fireDate).format(DATE_FORMAT),
		});
		await processProgramMapping(schedule);
		await updateDHIS2(schedule, {
			status: "scheduled",
			nextRun: dayjs(job.nextInvocation()).format(DATE_FORMAT),
			lastRun: dayjs(fireDate).format(DATE_FORMAT),
		});
	});
};

const ScheduleService: ServiceSchema<ScheduleSettings> = {
	name: "schedules",
	// version: 1,

	/**
	 * Mixins
	 */
	// mixins: [DbMixin("schedules")],

	/**
	 * Settings
	 */
	settings: {},

	/**
	 * Actions
	 */
	actions: {
		schedule: {
			rest: {
				method: "POST",
				path: "/",
			},
			async handler(this: ScheduleThis, ctx: Context<ISchedule>) {
				if (ctx.params.id && ctx.params.schedule) {
					const job = await createSchedule(ctx.params);
					await updateDHIS2(ctx.params, {
						nextRun: dayjs(job.nextInvocation()).format(DATE_FORMAT),
					});
					await write(ctx.params, {
						status: "scheduled",
						nextRun: dayjs(job.nextInvocation()).format(DATE_FORMAT),
					});
				}
				return { message: "Could not schedule with missing id field" };
			},
		},
		stop: {
			rest: {
				method: "POST",
				path: "/stop",
			},
			async handler(this: ScheduleThis, ctx: Context<{ id: string }>) {
				if (ctx.params.id) {
					const job = scheduledJobs[ctx.id];
					if (job) {
						const schedules = (await import("./schedules.json")).default;
						const schedule = schedules.find(({ id }) => id === ctx.params.id);

						if (schedule) {
							await updateDHIS2(schedule as ISchedule, {
								status: "stopped",
							});
							await write(schedule as ISchedule, {
								status: "stopped",
							});
							job.cancel();
						}
					}
				}
				return { message: "Could not schedule with missing id field" };
			},
		},
	},

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
		const schedules = (await import("./schedules.json")).default;
		for (const schedule of schedules) {
			if (schedule.status !== "stopped") {
				await createSchedule(schedule as ISchedule);
			} else {
				const job = await createSchedule(schedule as ISchedule);
				console.log("Are we here");
			}
		}
	},
	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {},
};

export default ScheduleService;
