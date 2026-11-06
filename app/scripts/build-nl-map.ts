// Extraheert de contour van Europees Nederland uit world-atlas (Natural Earth, publiek domein)
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import { COURTS } from "../src/lib/reference/courts";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-10m.json", "utf8"));
const fc = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;
const nl = fc.features.find((f) => f.properties?.name === "Netherlands")!;
// alleen polygonen in Europa (Caribisch Nederland weglaten)
const geom = nl.geometry as GeoJSON.MultiPolygon;
const euro: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: geom.coordinates.filter((poly) => poly[0][0][1] > 50) } };
const W = 400, H = 470;
const proj = geoMercator().fitSize([W, H], euro);
const d = geoPath(proj)(euro)!;
const round = d.replace(/(\d+\.\d{1})\d+/g, "$1");
const points = Object.fromEntries(COURTS.map((c) => [c.code, proj([c.lon, c.lat])!.map((v) => Math.round(v * 10) / 10)]));
writeFileSync("src/lib/reference/nl-map.json", JSON.stringify({ width: W, height: H, path: round, points }));
console.log("path bytes", round.length);
