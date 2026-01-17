/**
 * Map Components for Regional Business Sites
 * Provides React components for interactive clickable maps with GeoJSON data
 */

export interface MapRegion {
  id: string;
  name: string;
  nameLocal?: string;
  code: string;
  center: [number, number];
  data?: Record<string, unknown>;
}

export interface MapConfig {
  country: "china" | "russia" | "both";
  colorScheme?: "blue" | "green" | "orange" | "purple";
  showLabels?: boolean;
  enableZoom?: boolean;
  initialZoom?: number;
}

export const GEOJSON_SOURCES = {
  china: {
    provinces: "https://cdn.jsdelivr.net/npm/cn-atlas@0.1.2/provinces.json",
    simplified: "https://cdn.jsdelivr.net/npm/cn-atlas@0.1.2/provinces.json",
  },
  russia: {
    oblasts:
      "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/russia.geojson",
    simplified:
      "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/russia.geojson",
  },
};

export const CHINA_PROVINCES: MapRegion[] = [
  {
    id: "beijing",
    name: "Beijing",
    nameLocal: "北京",
    code: "BJ",
    center: [116.4, 39.9],
  },
  {
    id: "shanghai",
    name: "Shanghai",
    nameLocal: "上海",
    code: "SH",
    center: [121.5, 31.2],
  },
  {
    id: "guangdong",
    name: "Guangdong",
    nameLocal: "广东",
    code: "GD",
    center: [113.3, 23.1],
  },
  {
    id: "zhejiang",
    name: "Zhejiang",
    nameLocal: "浙江",
    code: "ZJ",
    center: [120.2, 30.3],
  },
  {
    id: "jiangsu",
    name: "Jiangsu",
    nameLocal: "江苏",
    code: "JS",
    center: [118.8, 32.1],
  },
  {
    id: "shandong",
    name: "Shandong",
    nameLocal: "山东",
    code: "SD",
    center: [117.0, 36.7],
  },
  {
    id: "henan",
    name: "Henan",
    nameLocal: "河南",
    code: "HA",
    center: [113.7, 34.8],
  },
  {
    id: "sichuan",
    name: "Sichuan",
    nameLocal: "四川",
    code: "SC",
    center: [104.1, 30.7],
  },
  {
    id: "hubei",
    name: "Hubei",
    nameLocal: "湖北",
    code: "HB",
    center: [114.3, 30.6],
  },
  {
    id: "hunan",
    name: "Hunan",
    nameLocal: "湖南",
    code: "HN",
    center: [113.0, 28.2],
  },
  {
    id: "fujian",
    name: "Fujian",
    nameLocal: "福建",
    code: "FJ",
    center: [119.3, 26.1],
  },
  {
    id: "anhui",
    name: "Anhui",
    nameLocal: "安徽",
    code: "AH",
    center: [117.3, 31.9],
  },
  {
    id: "liaoning",
    name: "Liaoning",
    nameLocal: "辽宁",
    code: "LN",
    center: [123.4, 41.8],
  },
  {
    id: "heilongjiang",
    name: "Heilongjiang",
    nameLocal: "黑龙江",
    code: "HL",
    center: [126.6, 45.8],
  },
  {
    id: "jilin",
    name: "Jilin",
    nameLocal: "吉林",
    code: "JL",
    center: [125.3, 43.9],
  },
  {
    id: "shaanxi",
    name: "Shaanxi",
    nameLocal: "陕西",
    code: "SN",
    center: [109.0, 34.3],
  },
  {
    id: "shanxi",
    name: "Shanxi",
    nameLocal: "山西",
    code: "SX",
    center: [112.5, 37.9],
  },
  {
    id: "yunnan",
    name: "Yunnan",
    nameLocal: "云南",
    code: "YN",
    center: [102.7, 25.0],
  },
  {
    id: "guizhou",
    name: "Guizhou",
    nameLocal: "贵州",
    code: "GZ",
    center: [106.7, 26.6],
  },
  {
    id: "guangxi",
    name: "Guangxi",
    nameLocal: "广西",
    code: "GX",
    center: [108.3, 22.8],
  },
  {
    id: "hebei",
    name: "Hebei",
    nameLocal: "河北",
    code: "HE",
    center: [114.5, 38.0],
  },
  {
    id: "jiangxi",
    name: "Jiangxi",
    nameLocal: "江西",
    code: "JX",
    center: [115.9, 28.7],
  },
  {
    id: "gansu",
    name: "Gansu",
    nameLocal: "甘肃",
    code: "GS",
    center: [103.8, 36.1],
  },
  {
    id: "neimenggu",
    name: "Inner Mongolia",
    nameLocal: "内蒙古",
    code: "NM",
    center: [111.7, 40.8],
  },
  {
    id: "xinjiang",
    name: "Xinjiang",
    nameLocal: "新疆",
    code: "XJ",
    center: [87.6, 43.8],
  },
  {
    id: "xizang",
    name: "Tibet",
    nameLocal: "西藏",
    code: "XZ",
    center: [91.1, 29.6],
  },
  {
    id: "qinghai",
    name: "Qinghai",
    nameLocal: "青海",
    code: "QH",
    center: [101.8, 36.6],
  },
  {
    id: "ningxia",
    name: "Ningxia",
    nameLocal: "宁夏",
    code: "NX",
    center: [106.3, 38.5],
  },
  {
    id: "hainan",
    name: "Hainan",
    nameLocal: "海南",
    code: "HI",
    center: [110.3, 20.0],
  },
  {
    id: "tianjin",
    name: "Tianjin",
    nameLocal: "天津",
    code: "TJ",
    center: [117.2, 39.1],
  },
  {
    id: "chongqing",
    name: "Chongqing",
    nameLocal: "重庆",
    code: "CQ",
    center: [106.5, 29.6],
  },
  {
    id: "hongkong",
    name: "Hong Kong",
    nameLocal: "香港",
    code: "HK",
    center: [114.2, 22.3],
  },
  {
    id: "macau",
    name: "Macau",
    nameLocal: "澳门",
    code: "MO",
    center: [113.5, 22.2],
  },
  {
    id: "taiwan",
    name: "Taiwan",
    nameLocal: "台湾",
    code: "TW",
    center: [121.0, 23.5],
  },
];

export const RUSSIA_REGIONS: MapRegion[] = [
  {
    id: "moscow",
    name: "Moscow",
    nameLocal: "Москва",
    code: "MOW",
    center: [37.6, 55.8],
  },
  {
    id: "spb",
    name: "Saint Petersburg",
    nameLocal: "Санкт-Петербург",
    code: "SPE",
    center: [30.3, 59.9],
  },
  {
    id: "novosibirsk",
    name: "Novosibirsk Oblast",
    nameLocal: "Новосибирская область",
    code: "NVS",
    center: [83.0, 55.0],
  },
  {
    id: "sverdlovsk",
    name: "Sverdlovsk Oblast",
    nameLocal: "Свердловская область",
    code: "SVE",
    center: [60.6, 56.8],
  },
  {
    id: "tatarstan",
    name: "Tatarstan",
    nameLocal: "Татарстан",
    code: "TA",
    center: [49.1, 55.8],
  },
  {
    id: "chelyabinsk",
    name: "Chelyabinsk Oblast",
    nameLocal: "Челябинская область",
    code: "CHE",
    center: [61.4, 55.2],
  },
  {
    id: "nizhny",
    name: "Nizhny Novgorod Oblast",
    nameLocal: "Нижегородская область",
    code: "NIZ",
    center: [44.0, 56.3],
  },
  {
    id: "samara",
    name: "Samara Oblast",
    nameLocal: "Самарская область",
    code: "SAM",
    center: [50.2, 53.2],
  },
  {
    id: "krasnodar",
    name: "Krasnodar Krai",
    nameLocal: "Краснодарский край",
    code: "KDA",
    center: [39.0, 45.0],
  },
  {
    id: "krasnoyarsk",
    name: "Krasnoyarsk Krai",
    nameLocal: "Красноярский край",
    code: "KYA",
    center: [93.0, 56.0],
  },
  {
    id: "primorsky",
    name: "Primorsky Krai",
    nameLocal: "Приморский край",
    code: "PRI",
    center: [133.0, 44.0],
  },
  {
    id: "khabarovsk",
    name: "Khabarovsk Krai",
    nameLocal: "Хабаровский край",
    code: "KHA",
    center: [135.1, 48.5],
  },
  {
    id: "irkutsk",
    name: "Irkutsk Oblast",
    nameLocal: "Иркутская область",
    code: "IRK",
    center: [104.3, 52.3],
  },
  {
    id: "bashkortostan",
    name: "Bashkortostan",
    nameLocal: "Башкортостан",
    code: "BA",
    center: [56.0, 54.7],
  },
  {
    id: "rostov",
    name: "Rostov Oblast",
    nameLocal: "Ростовская область",
    code: "ROS",
    center: [39.7, 47.2],
  },
  {
    id: "omsk",
    name: "Omsk Oblast",
    nameLocal: "Омская область",
    code: "OMS",
    center: [73.4, 55.0],
  },
  {
    id: "volgograd",
    name: "Volgograd Oblast",
    nameLocal: "Волгоградская область",
    code: "VGG",
    center: [44.5, 48.7],
  },
  {
    id: "perm",
    name: "Perm Krai",
    nameLocal: "Пермский край",
    code: "PER",
    center: [56.2, 58.0],
  },
  {
    id: "voronezh",
    name: "Voronezh Oblast",
    nameLocal: "Воронежская область",
    code: "VOR",
    center: [39.2, 51.7],
  },
  {
    id: "saratov",
    name: "Saratov Oblast",
    nameLocal: "Саратовская область",
    code: "SAR",
    center: [46.0, 51.5],
  },
  {
    id: "sakhalin",
    name: "Sakhalin Oblast",
    nameLocal: "Сахалинская область",
    code: "SAK",
    center: [142.7, 46.9],
  },
  {
    id: "yakutia",
    name: "Sakha (Yakutia)",
    nameLocal: "Саха (Якутия)",
    code: "SA",
    center: [129.7, 62.0],
  },
  {
    id: "amur",
    name: "Amur Oblast",
    nameLocal: "Амурская область",
    code: "AMU",
    center: [128.0, 50.3],
  },
  {
    id: "zabaykalsky",
    name: "Zabaykalsky Krai",
    nameLocal: "Забайкальский край",
    code: "ZAB",
    center: [113.5, 52.0],
  },
  {
    id: "buryatia",
    name: "Buryatia",
    nameLocal: "Бурятия",
    code: "BU",
    center: [107.6, 51.8],
  },
];

export function generateMapComponentCode(config: MapConfig): string {
  const colorSchemes = {
    blue: { default: "#E3F2FD", hover: "#1976D2", active: "#0D47A1" },
    green: { default: "#E8F5E9", hover: "#43A047", active: "#1B5E20" },
    orange: { default: "#FFF3E0", hover: "#FB8C00", active: "#E65100" },
    purple: { default: "#F3E5F5", hover: "#8E24AA", active: "#4A148C" },
  };
  const colors = colorSchemes[config.colorScheme || "blue"];

  return `"use client";

import { useState, useEffect, useCallback, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";
import { useRouter } from "next/navigation";

interface RegionData {
  id: string;
  name: string;
  nameLocal?: string;
  code: string;
  opportunityCount?: number;
}

interface InteractiveMapProps {
  country: "china" | "russia";
  regions: RegionData[];
  onRegionClick?: (regionId: string) => void;
  selectedRegion?: string | null;
}

const GEOJSON_URLS = {
  china: "https://cdn.jsdelivr.net/npm/cn-atlas@0.1.2/provinces.json",
  russia:
    "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/russia.geojson",
};

const MAP_CONFIG = {
  china: {
    center: [105, 35] as [number, number],
    scale: 600,
  },
  russia: {
    center: [100, 60] as [number, number],
    scale: 300,
  },
};

function InteractiveMap({
  country,
  regions,
  onRegionClick,
  selectedRegion,
}: InteractiveMapProps) {
  const router = useRouter();
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<unknown>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    fetch(GEOJSON_URLS[country])
      .then((res) => res.json())
      .then(setGeoData)
      .catch(console.error);
  }, [country]);

  const handleRegionClick = useCallback(
    (regionId: string) => {
      if (onRegionClick) {
        onRegionClick(regionId);
      } else {
        router.push(\`/region/\${regionId}\`);
      }
    },
    [onRegionClick, router]
  );

  const getRegionStyle = useCallback(
    (geo: { properties: { name?: string; NAME?: string } }) => {
      const regionName = geo.properties.name || geo.properties.NAME || "";
      const region = regions.find(
        (r) =>
          r.name.toLowerCase() === regionName.toLowerCase() ||
          r.nameLocal === regionName
      );
      const isHovered = hoveredRegion === region?.id;
      const isSelected = selectedRegion === region?.id;

      return {
        default: {
          fill: isSelected
            ? "${colors.active}"
            : isHovered
              ? "${colors.hover}"
              : "${colors.default}",
          stroke: "#FFFFFF",
          strokeWidth: 0.5,
          outline: "none",
          cursor: "pointer",
          transition: "fill 0.2s ease",
        },
        hover: {
          fill: "${colors.hover}",
          stroke: "#FFFFFF",
          strokeWidth: 1,
          outline: "none",
          cursor: "pointer",
        },
        pressed: {
          fill: "${colors.active}",
          stroke: "#FFFFFF",
          strokeWidth: 1,
          outline: "none",
        },
      };
    },
    [hoveredRegion, selectedRegion, regions]
  );

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const { center, scale } = MAP_CONFIG[country];

  return (
    <div className="relative w-full h-[600px] bg-gray-50 rounded-lg overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center, scale: scale * zoom }}
        className="w-full h-full"
      >
        <ZoomableGroup
          zoom={zoom}
          onMoveEnd={({ zoom: newZoom }) => setZoom(newZoom)}
          ${config.enableZoom ? "" : "disablePanning disableZooming"}
        >
          <Geographies geography={geoData}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const regionName =
                  geo.properties.name || geo.properties.NAME || "";
                const region = regions.find(
                  (r) =>
                    r.name.toLowerCase() === regionName.toLowerCase() ||
                    r.nameLocal === regionName
                );

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={getRegionStyle(geo)}
                    onMouseEnter={() => region && setHoveredRegion(region.id)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    onClick={() => region && handleRegionClick(region.id)}
                  />
                );
              })
            }
          </Geographies>
          ${
            config.showLabels
              ? `
          {regions.map((region) => (
            <Marker key={region.id} coordinates={[0, 0]}>
              <text
                textAnchor="middle"
                className="text-xs fill-gray-700 pointer-events-none"
              >
                {region.name}
              </text>
            </Marker>
          ))}
          `
              : ""
          }
        </ZoomableGroup>
      </ComposableMap>

      {hoveredRegion && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">
            {regions.find((r) => r.id === hoveredRegion)?.name}
          </p>
          <p className="text-sm text-gray-600">
            {regions.find((r) => r.id === hoveredRegion)?.nameLocal}
          </p>
          {regions.find((r) => r.id === hoveredRegion)?.opportunityCount !==
            undefined && (
            <p className="text-sm text-blue-600">
              {regions.find((r) => r.id === hoveredRegion)?.opportunityCount}{" "}
              opportunities
            </p>
          )}
        </div>
      )}

      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.5, 8))}
          className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.5, 0.5))}
          className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50"
        >
          -
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 text-xs"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default memo(InteractiveMap);
`;
}

export function generateDualMapComponentCode(config: MapConfig): string {
  return `"use client";

import { useState } from "react";
import InteractiveMap from "./InteractiveMap";

interface DualMapViewProps {
  chinaRegions: Array<{
    id: string;
    name: string;
    nameLocal?: string;
    code: string;
    opportunityCount?: number;
  }>;
  russiaRegions: Array<{
    id: string;
    name: string;
    nameLocal?: string;
    code: string;
    opportunityCount?: number;
  }>;
}

export default function DualMapView({
  chinaRegions,
  russiaRegions,
}: DualMapViewProps) {
  const [activeTab, setActiveTab] = useState<"china" | "russia" | "both">("both");

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab("china")}
            className={\`px-6 py-2 rounded-md text-sm font-medium transition-colors \${
              activeTab === "china"
                ? "bg-white text-gray-900 shadow"
                : "text-gray-600 hover:text-gray-900"
            }\`}
          >
            China
          </button>
          <button
            onClick={() => setActiveTab("russia")}
            className={\`px-6 py-2 rounded-md text-sm font-medium transition-colors \${
              activeTab === "russia"
                ? "bg-white text-gray-900 shadow"
                : "text-gray-600 hover:text-gray-900"
            }\`}
          >
            Russia
          </button>
          <button
            onClick={() => setActiveTab("both")}
            className={\`px-6 py-2 rounded-md text-sm font-medium transition-colors \${
              activeTab === "both"
                ? "bg-white text-gray-900 shadow"
                : "text-gray-600 hover:text-gray-900"
            }\`}
          >
            Both
          </button>
        </div>
      </div>

      <div className={\`grid gap-6 \${activeTab === "both" ? "lg:grid-cols-2" : "grid-cols-1"}\`}>
        {(activeTab === "china" || activeTab === "both") && (
          <div>
            <h2 className="text-xl font-bold mb-4">China Provinces</h2>
            <InteractiveMap country="china" regions={chinaRegions} />
          </div>
        )}
        {(activeTab === "russia" || activeTab === "both") && (
          <div>
            <h2 className="text-xl font-bold mb-4">Russia Regions</h2>
            <InteractiveMap country="russia" regions={russiaRegions} />
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

export function generateRegionPageCode(): string {
  return `"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  sector: string;
  investmentRange: string;
  contactEmail?: string;
  createdAt: string;
}

interface RegionDetails {
  id: string;
  name: string;
  nameLocal?: string;
  country: "china" | "russia";
  description: string;
  population?: number;
  gdp?: number;
  keyIndustries: string[];
  opportunities: Opportunity[];
}

async function fetchRegionDetails(regionId: string): Promise<RegionDetails> {
  const res = await fetch(\`/api/regions/\${regionId}\`);
  if (!res.ok) throw new Error("Failed to fetch region");
  return res.json();
}

export default function RegionPage() {
  const params = useParams();
  const regionId = params.regionId as string;

  const { data: region, isLoading, error } = useQuery({
    queryKey: ["region", regionId],
    queryFn: () => fetchRegionDetails(regionId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !region) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Region not found</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to map
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to map
        </Link>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{region.name}</h1>
              {region.nameLocal && (
                <p className="text-2xl text-gray-600 mt-1">{region.nameLocal}</p>
              )}
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {region.country === "china" ? "China" : "Russia"}
              </span>
            </div>
          </div>

          <p className="mt-6 text-gray-700 text-lg">{region.description}</p>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {region.population && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Population</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(region.population / 1_000_000).toFixed(1)}M
                </p>
              </div>
            )}
            {region.gdp && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">GDP</p>
                <p className="text-2xl font-bold text-gray-900">
                  \${(region.gdp / 1_000_000_000).toFixed(1)}B
                </p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">
                {region.opportunities.length}
              </p>
            </div>
          </div>

          {region.keyIndustries.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Key Industries
              </h3>
              <div className="flex flex-wrap gap-2">
                {region.keyIndustries.map((industry) => (
                  <span
                    key={industry}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {industry}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Business Opportunities
        </h2>

        {region.opportunities.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-600">
              No opportunities listed for this region yet.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {region.opportunities.map((opp) => (
              <div
                key={opp.id}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs mb-3">
                  {opp.sector}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {opp.title}
                </h3>
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {opp.description}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 font-medium">
                    {opp.investmentRange}
                  </span>
                  {opp.contactEmail && (
                    <a
                      href={\`mailto:\${opp.contactEmail}\`}
                      className="text-blue-600 hover:underline"
                    >
                      Contact
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

export function getMapDependencies(): Record<string, string> {
  return {
    "react-simple-maps": "^3.0.0",
    "@tanstack/react-query": "^5.0.0",
    "d3-geo": "^3.1.0",
  };
}

export function getMapDevDependencies(): Record<string, string> {
  return {
    "@types/d3-geo": "^3.1.0",
  };
}
