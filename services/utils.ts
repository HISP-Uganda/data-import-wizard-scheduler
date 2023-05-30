import axios, { AxiosInstance } from "axios";
import uniq from "lodash/uniq";
import fromPairs from "lodash/fromPairs";
import groupBy from "lodash/groupBy";
import { ScheduleEntity } from "./schedule.service";
import { scheduleJob } from "node-schedule";

import {
	makeMetadata,
	makeValidation,
	processPreviousInstances,
	programStageUniqElements,
	programUniqAttributes,
	programUniqColumns,
	CommonIdentifier,
	IProgram,
	IProgramMapping,
	Mapping,
	StageMapping,
	TrackedEntityInstance,
} from "data-import-wizard-utils";

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
			console.log(results);
			// try {
			// 	const response = await remoteApi.post("", results);
			// 	console.log("info", JSON.stringify(response.data));
			// } catch (error) {
			// 	console.log("error", error.message);
			// }
		});
	}
};

export const processProgramMapping = async (m: ScheduleEntity) => {
	const api = axios.create({
		baseURL: "http://localhost:8080/api/",
		auth: {
			username: "admin",
			password: "district",
		},
	});

	const { data: programMapping } = await api.get<IProgramMapping>(
		`dataStore/iw-program-mapping/${m.mapping}`,
	);
	const { data: attributeMapping } = await api.get<Mapping>(
		`dataStore/iw-attribute-mapping/${m.mapping}`,
	);
	const { data: programStageMapping } = await api.get<StageMapping>(
		`dataStore/iw-stage-mapping/${m.mapping}`,
	);
	const { data: organisationUnitMapping } = await api.get<StageMapping>(
		`dataStore/iw-ou-mapping/${m.mapping}`,
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

	// const metadata = makeMetadata(
	// 	programMapping,
	// 	[],
	// 	program,
	// 	programStageMapping,
	// 	attributeMapping,
	// );

	let params = new URLSearchParams();
	// metadata.uniqueAttributeValues.forEach(({ attribute, value }) => {
	// 	params.append("filter", `${attribute}:eq:${value}`);
	// });
	params.append("fields", "*");
	params.append("program", programMapping.program || "");
	params.append("ouMode", "ALL");

	const {
		data: { trackedEntityInstances },
	} = await api.get<{ trackedEntityInstances: TrackedEntityInstance[] }>(
		`trackedEntityInstances.json?${params.toString()}`,
	);

	const previous = processPreviousInstances(
		trackedEntityInstances,
		uniqAttribute,
		uniqueElements,
		programMapping.program || "",
	);

	// const {
	// 	enrollments,
	// 	events,
	// 	trackedEntityInstances: processedInstances,
	// } = await processData(
	// 	previous,
	// 	[],
	// 	programMapping,
	// 	organisationUnitMapping,
	// 	attributeMapping,
	// 	programStageMapping,
	// 	uniqAttribute,
	// 	uniqueElements,
	// 	uniqColumns,
	// 	2,
	// 	program,
	// 	elements,
	// 	attributes,
	// );

	console.log(
		program,
		programMapping,
		attributeMapping,
		// stageMapping,
		// organisationMapping,
	);
};
