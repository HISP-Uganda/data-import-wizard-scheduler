import axios, { AxiosInstance } from "axios";
import fromPairs from "lodash/fromPairs";
import groupBy from "lodash/groupBy";
import uniq from "lodash/uniq";
import dhis2 from "./dhis2.json";
// import { ScheduleEntity } from "./schedule.service";

import {
	Authentication,
	CommonIdentifier,
	GODataTokenGenerationResponse,
	IGoData,
	IProgram,
	IProgramMapping,
	ISchedule,
	Mapping,
	StageMapping,
	TrackedEntityInstance,
	convertToDHIS2,
	convertToGoData,
	fetchRemote,
	findUniqAttributes,
	makeMetadata,
	makeValidation,
	postRemote,
	processPreviousInstances,
	programStageUniqElements,
	programUniqAttributes,
	programUniqColumns,
} from "data-import-wizard-utils";
import { chunk } from "lodash/fp";

interface Organisation extends CommonIdentifier {
	path: string;
	// parent: Organisation;
}

export const syncTrackedEntityInstances = async (
	api: AxiosInstance,
	program: string,
	upstream: string,
	others: { [key: string]: any },
) => {
	const remoteApi = axios.create({
		baseURL: upstream,
	});
	const params = new URLSearchParams({
		ouMode: "ALL",
		program,
		pageSize: "10",
		fields: "*",
		...others,
	});
	const {
		data: { trackedEntityInstances },
	} = await api.get<{ trackedEntityInstances: TrackedEntityInstance[] }>(
		"trackedEntityInstances.json",
		{ params },
	);
	if (trackedEntityInstances.length > 0) {
		const {
			data: { organisationUnits },
		} = await api.get<{ organisationUnits: Organisation[] }>("organisationUnits.json", {
			params: new URLSearchParams({
				filter: `id:in:[${uniq(
					trackedEntityInstances.map((instance) => {
						return instance.orgUnit;
					}),
				).join(",")}]`,
				fields: "id,name,code,path,parent[id,name,parent[id,name,parent[id,name]]]",
				paging: "false",
			}),
		});

		const organisations = fromPairs(
			organisationUnits.map((o) => {
				return [o.id, o.name];
			}),
		);

		const districts = organisationUnits.map((o) => {
			const paths = String(o.path).split("/");
			return paths[3];
		});

		const calculatedDistricts: { [key: string]: any } = {};

		// const calculatedDistricts = _.fromPairs(
		// 	orgUnits.map((o) => {
		// 		const paths = String(o.path).split("/");
		// 		return [o.id, realDistricts[paths[3]]];
		// 	}),
		// );

		trackedEntityInstances.forEach(async ({ attributes, enrollments }) => {
			let data: { [key: string]: any } = fromPairs(
				attributes.map(({ attribute, value }) => {
					return [attribute || "", value || ""];
				}),
			);

			const enrollment = enrollments.find((e) => e.program === program);

			if (enrollment) {
				const { events, ...others } = enrollment;
				const allEvents = events?.map(({ dataValues, ...rest }) => {
					const elements = fromPairs(
						dataValues.map(({ dataElement, value }) => [
							dataElement || "",
							value || "",
						]),
					);
					return { ...rest, ...elements };
				});
				data = {
					...data,
					...others,
					...groupBy(allEvents, "programStage"),
				};
			}

			let units = "Years";
			let years = data.UezutfURtQG;

			let labRequests: { [key: string]: any } = {};

			if (data.zKFHLSj6Wd1 && data.zKFHLSj6Wd1.length > 0) {
				labRequests = data.zKFHLSj6Wd1[data.zKFHLSj6Wd1.length - 1];
			}

			let eacDriverId = "";
			if (data.x2mmRJ3TOXQ !== undefined && data.x2mmRJ3TOXQ !== null) {
				const chunks = String(data.x2mmRJ3TOXQ).split("|");
				if (chunks.length > 2) {
					eacDriverId = chunks[2];
				} else if (chunks.length > 0) {
					eacDriverId = chunks[0];
				}
			}

			const results = {
				screenerName: data.TU0Jteb9H7F,
				organisation: organisations[data.orgUnit],
				organisationId: data.orgUnit,
				sampleCollectionDate: data.enrollmentDate,
				sampleCollectionLocation: data.cRRJ9fsIYYz,
				typeOfPersonTested: data.xwvCR3dis60 || "",
				fullName: data.sB1IHYu2xQT || "",
				formId: data.PVXhTjVdB92 || "",
				barcode: data.rSKAr1Ho7rI || "",
				poeId: data.HAZ7VQ730yn || "",
				dob: data.g4LJbkM0R24 || "",
				sex: data.Rq4qM2wKYFL || "",
				passportOrNInNo: data.oUqWGeHjj5C || "",
				casePhoneContact: data.E7u9XdW24SP || "",
				nationality: data.XvETY1aTxuB || "",
				entryDate: data.UJiu0P8GvHt || "",
				truckOrFlightNo: data.h6aZFN4DLcR || "",
				seatNo: data.XX8NZilra7b || "",
				departure: data.cW0UPEANS5t || "",
				destination: data.pxcXhmjJeMv || "",
				addressInUganda: data.ooK7aSiAaGq || "",
				plannedDuration: data.eH7YTWgoHgo || "",
				needForIsolation: data.Ep6evsVocKY || "",
				underQuarantine: data.oVFYcqtwPY9 || "",
				referredForFurtherInvestigation: data.EZwIFcKvSes || "",
				nokName: data.fik9qo8iHeo || "",
				nokPhone: data.j6sEr8EcULP || "",
				temperature: data.QhDKRe2QDA7 || "",
				freeFromSymptoms: data.EWWNozu6TVd || "",
				selectSymptoms: data.lByQFYSVb2Z || "",
				knownUnderlyingConditions: data.VS4GY78XPaH || "",
				// sampleType: data.SI7jnNQpEQM || "",
				reasonsForHWTesting: data.kwNWq4drD2G || "",
				age: Number(years).toFixed(0),
				ageUnits: units,
				eacDriverId,
				district: calculatedDistricts[data.orgUnit],
				sampleType: labRequests["PaCUNfho8eD"] || "",
				testType: labRequests["Iwiv0W39Yqq"] || "",
			};
			try {
				const response = await remoteApi.post("", results);
				console.log("info", JSON.stringify(response.data));
			} catch (error) {
				console.log("error", error.message);
			}
		});
	}
};

export const getGoDataToken = async (programMapping: Partial<IProgramMapping>) => {
	if (programMapping.authentication) {
		const { params, basicAuth, hasNextLink, headers, password, username, ...rest } =
			programMapping.authentication;

		const data = await postRemote<GODataTokenGenerationResponse>(rest, "api/users/login", {
			email: username,
			password: password,
		});
		return data.id;
	}
};

export const queryGoData = async <T>(
	programMapping: Partial<IProgramMapping>,
	token: string,
	endpoint: string,
) => {
	if (token && programMapping.authentication) {
		const { params, basicAuth, hasNextLink, headers, password, username, ...rest } =
			programMapping.authentication;

		let currentAuth: Partial<Authentication> = rest;
		currentAuth = {
			...currentAuth,
			basicAuth: false,
			params: {
				...params,
				auth: {
					param: "access_token",
					value: token,
				},
			},
			headers,
		};
		return await fetchRemote<T>(currentAuth, endpoint);
	}
};

export const processProgramMapping = async (schedule: Partial<ISchedule>) => {
	const availableLogins = dhis2 as {
		[key: string]: { username: string; password: string; url: string };
	};
	const logins = availableLogins[schedule?.id || ""];
	if (logins) {
		const api = axios.create({
			baseURL: logins.url,
			auth: {
				username: logins.username,
				password: logins.password,
			},
		});
		const { data: programMapping } = await api.get<IProgramMapping>(
			`dataStore/iw-program-mapping/${schedule.mapping}`,
		);
		const { data: attributeMapping } = await api.get<Mapping>(
			`dataStore/iw-attribute-mapping/${schedule.mapping}`,
		);
		const { data: programStageMapping } = await api.get<StageMapping>(
			`dataStore/iw-stage-mapping/${schedule.mapping}`,
		);
		const { data: organisationUnitMapping } = await api.get<StageMapping>(
			`dataStore/iw-ou-mapping/${schedule.mapping}`,
		);
		const { data: program } = await api.get<IProgram>(`programs/${programMapping.program}`, {
			params: new URLSearchParams({
				fields: "trackedEntityType,organisationUnits[id,code,name],programStages[id,repeatable,name,code,programStageDataElements[id,compulsory,name,dataElement[id,name,code]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]",
			}),
		});

		const { attributes, elements } = makeValidation(program);

		const uniqAttribute = programUniqAttributes(attributeMapping);
		const uniqueElements = programStageUniqElements(programStageMapping);
		const uniqColumns = programUniqColumns(attributeMapping);

		if (programMapping.isSource) {
			if (programMapping.dataSource === "dhis2") {
			} else if (programMapping.dataSource === "godata" && programMapping.remoteProgram) {
				const token = await getGoDataToken(programMapping);
				if (token) {
					let loop = true;
					let page = 1;

					const outbreak = await queryGoData<IGoData>(
						programMapping,
						token,
						`api/outbreaks/${programMapping.remoteProgram}`,
					);
					const previousData = await queryGoData<IGoData>(
						programMapping,
						token,
						`api/outbreaks/${programMapping.remoteProgram}/cases`,
					);
					if (outbreak) {
						do {
							let params = new URLSearchParams();
							params.set("fields", "*");
							params.set("program", programMapping.program);
							params.set("ouMode", "ALL");
							params.set("page", String(page));
							const { data } = await api.get<{
								trackedEntityInstances: TrackedEntityInstance[];
							}>(`trackedEntityInstances.json?${params.toString()}`);

							const converted = convertToGoData(
								data,
								organisationUnitMapping,
								attributeMapping,
								outbreak,
							);
							loop = data.trackedEntityInstances.length === 0;
							page++;
						} while (loop);
					}
				}
			} else if (programMapping.dataSource === "api") {
			}
		} else {
			if (programMapping.dataSource === "dhis2") {
			} else if (programMapping.dataSource === "godata" && programMapping.remoteProgram) {
				const token = await getGoDataToken(programMapping);
				if (token) {
					const goDataData = await queryGoData<any[]>(
						programMapping,
						token,
						`api/outbreaks/${programMapping.remoteProgram}/cases`,
					);

					if (goDataData) {
						const uniqueAttributeValues = findUniqAttributes(
							goDataData,
							attributeMapping,
						);
						let foundInstances: Array<TrackedEntityInstance> = [];

						for (const attributeValues of chunk(50, uniqueAttributeValues)) {
							let params = new URLSearchParams();
							Object.entries(groupBy(attributeValues, "attribute")).forEach(
								([attribute, values]) => {
									params.append(
										"filter",
										`${attribute}:in:${values
											.map(({ value }) => value)
											.join(";")}`,
									);
								},
							);
							params.append("fields", "*");
							params.append("program", programMapping.program);
							params.append("ouMode", "ALL");
							const {
								data: { trackedEntityInstances },
							} = await api.get<{ trackedEntityInstances: TrackedEntityInstance[] }>(
								`trackedEntityInstances.json?${params.toString()}`,
							);
							foundInstances = [...foundInstances, ...trackedEntityInstances];
						}

						const previous = processPreviousInstances(
							foundInstances,
							uniqAttribute,
							uniqueElements,
							programMapping.program,
						);
						const data = await convertToDHIS2(
							previous,
							goDataData,
							programMapping,
							organisationUnitMapping,
							attributeMapping,
							programStageMapping,
							1,
							program,
							elements,
							attributes,
						);
					}
				}
			} else if (programMapping.dataSource === "api") {
			}
		}
	}
};
