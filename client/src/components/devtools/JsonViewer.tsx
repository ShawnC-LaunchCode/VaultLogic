import { useMemo, useRef, useState, useEffect } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

SyntaxHighlighter.registerLanguage("json", json);

interface JsonViewerProps {
    data: Record<string, any>;
    className?: string;
}

// Helper to check if two values are effectively different
function isDifferent(val1: any, val2: any): boolean {
    if (val1 === val2) return false;
    if (typeof val1 !== typeof val2) return true;
    if (typeof val1 === 'object' && val1 !== null && val2 !== null) {
        if (Array.isArray(val1) !== Array.isArray(val2)) return true;
        return JSON.stringify(val1) !== JSON.stringify(val2);
    }
    return true;
}

// Custom Pretty Printer that maps paths to line numbers
function prettyPrintWithMap(data: any): { jsonString: string; lineMap: Map<string, number> } {
    let line = 1;
    const lineMap = new Map<string, number>();

    function serialize(obj: any, indent: number, path: string[]) {
        const spacer = " ".repeat(indent);

        if (typeof obj !== "object" || obj === null) {
            // Primitive
            return JSON.stringify(obj);
        }

        const isArray = Array.isArray(obj);
        let str = isArray ? "[" : "{";

        const keys = Object.keys(obj);
        if (keys.length > 0) {
            str += "\n";
            line++;

            keys.forEach((key, index) => {
                const value = obj[key];
                const currentPath = isArray ? [...path] : [...path, key]; // Arrays dont strictly have keyed paths in this simplistic view
                const pathKey = currentPath.join(".");

                // Track line number for this key
                if (!isArray) {
                    lineMap.set(pathKey, line);
                }

                str += spacer + "  "; // Indent for key
                if (!isArray) {
                    str += `"${key}": `;
                }

                const valStr = serialize(value, indent + 2, currentPath);
                str += valStr;

                if (index < keys.length - 1) {
                    str += ",";
                }
                str += "\n";
                line++;
            });

            str += spacer + (isArray ? "]" : "}");
        } else {
            str += isArray ? "[]" : "{}";
        }

        return str;
    }

    const jsonString = serialize(data, 0, []);
    return { jsonString, lineMap };
}

// Hook to detect dark mode from HTML class
function useDarkModeObserver() {
    const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "class") {
                    setIsDark(document.documentElement.classList.contains("dark"));
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    return isDark;
}

interface HighlightInfo {
    line: number;
    ts: number;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
    const isDark = useDarkModeObserver();
    const [highlights, setHighlights] = useState<HighlightInfo[]>([]);
    const prevDataRef = useRef<Record<string, any>>({});

    // Calculate JSON string and line map
    const { jsonString, lineMap } = useMemo(() => prettyPrintWithMap(data), [data]);

    useEffect(() => {
        const prevData = prevDataRef.current;
        // console.log("[JsonViewer] Data update. Keys:", Object.keys(data).length);

        const newHighlights: HighlightInfo[] = [];
        const now = Date.now();

        // Helper to get value by path
        const getVal = (obj: any, pathStr: string) => {
            if (!pathStr) return undefined;
            const path = pathStr.split('.');
            let current = obj;
            for (const key of path) {
                if (current === undefined || current === null) return undefined;
                current = current[key];
            }
            return current;
        };

        lineMap.forEach((lineNum, pathStr) => {
            const currVal = getVal(data, pathStr);
            const prevVal = getVal(prevData, pathStr);

            // Check for changes
            // 1. Value changed
            // 2. New value (and not initial load)
            if (
                (isDifferent(currVal, prevVal) && prevVal !== undefined) ||
                (prevVal === undefined && currVal !== undefined && Object.keys(prevData).length > 0)
            ) {
                // console.log(`[JsonViewer] Change at ${pathStr} (Line ${lineNum})`);
                newHighlights.push({ line: lineNum, ts: now });
            }
        });

        if (newHighlights.length > 0) {
            setHighlights(prev => {
                // Keep existing highlights that haven't expired, plus new ones.
                // If a line is in both, take the new one (new TS) to restart animation.
                const map = new Map<number, number>();
                prev.forEach(h => map.set(h.line, h.ts));
                newHighlights.forEach(h => map.set(h.line, h.ts));

                return Array.from(map.entries()).map(([line, ts]) => ({ line, ts }));
            });

            // Cleanup after 5s
            const timer = setTimeout(() => {
                setHighlights(current => {
                    const threshold = Date.now() - 5000;
                    return current.filter(h => h.ts > threshold);
                });
            }, 5000);

            prevDataRef.current = data;
            return () => clearTimeout(timer);
        }

        prevDataRef.current = data;
    }, [data, lineMap]);

    return (
        <div className={`text-xs h-full w-full overflow-auto ${className || ""}`}>
            <SyntaxHighlighter
                language="json"
                style={isDark ? oneDark : oneLight}
                customStyle={{ margin: 0, height: "100%", background: "transparent" }}
                wrapLines={true}
                showLineNumbers={true}
                lineNumberStyle={{ display: "none" }}
                lineProps={(lineNumber) => {
                    // console.log("[JsonViewer] lineProps called with:", lineNumber, "typeof:", typeof lineNumber);
                    const highlight = highlights.find(h => h.line === lineNumber);
                    const isHighlighted = !!highlight;

                    return {
                        style: {
                            display: "block",
                            width: "100%",
                        },
                        className: isHighlighted ? "animate-highlight" : undefined,
                        // Provide explicit key for ALL lines to avoid mixing controlled/uncontrolled keys
                        // Change key when highlighted to force remount and restart animation
                        key: isHighlighted
                            ? `line-${lineNumber}-hl-${highlight.ts}`
                            : `line-${lineNumber}`
                    };
                }}
            >
                {jsonString}
            </SyntaxHighlighter>
            <style>{`
        @keyframes highlightFade {
            0% { background-color: ${isDark ? "rgba(255, 255, 0, 0.2)" : "rgba(255, 255, 0, 0.5)"}; }
            100% { background-color: transparent; }
        }
        .animate-highlight {
            animation: highlightFade 2s ease-out forwards;
        }
      `}</style>
        </div>
    );
}
