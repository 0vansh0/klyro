import {
  siC,
  siCplusplus,
  siDotnet,
  siFastapi,
  siHtml5,
  siJavascript,
  siLua,
  siMongodb,
  siMysql,
  siNodedotjs,
  siOpenjdk,
  siPhp,
  siPostgresql,
  siPython,
  siReact,
  siSpring,
} from "simple-icons";

const profiles = [
  { name: "HTML", grammar: "html", parserLabel: "HTML-Validate · standards checks", extension: "html", icon: siHtml5, color: "#e34f26", category: "Web", description: "HTML markup and accessibility rules" },
  { name: "Python", grammar: "python", extension: "py", icon: siPython, color: "#3776ab", category: "Programming", description: "Python syntax" },
  { name: "JavaScript", grammar: "javascript", extension: "js", icon: siJavascript, color: "#f7df1e", category: "Programming", description: "ESLint code quality rules and safe fixes" },
  { name: "Java", grammar: "java", extension: "java", icon: siOpenjdk, color: "#f89820", category: "Programming", description: "Java syntax" },
  { name: "MySQL", grammar: "sql", parserLabel: "MySQL SQL syntax parser", extension: "sql", icon: siMysql, color: "#4479a1", category: "Databases", description: "MySQL dialect syntax checks" },
  { name: "C", grammar: "c", extension: "c", icon: siC, color: "#a8b9cc", category: "Programming", description: "C syntax" },
  { name: "C++", grammar: "cpp", extension: "cpp", icon: siCplusplus, color: "#00599c", category: "Programming", description: "C++ syntax" },
  { name: "PHP", grammar: "php", extension: "php", icon: siPhp, color: "#777bb4", category: "Web", description: "PHP syntax" },
  { name: "C#", grammar: "csharp", extension: "cs", icon: siDotnet, color: "#512bd4", category: "Programming", description: "C# syntax" },
  { name: "FastAPI", grammar: "python", extension: "py", icon: siFastapi, color: "#009688", category: "Web", description: "Python syntax for FastAPI projects" },
  { name: "Lua", grammar: "lua", extension: "lua", icon: siLua, color: "#2c2d72", category: "Programming", description: "Lua syntax" },
  { name: "PL/SQL", grammar: "sql", parserLabel: "Basic SQL syntax · no PL/SQL blocks", extension: "sql", icon: null, color: "#c74634", category: "Databases", description: "Basic SQL statements; procedural PL/SQL blocks are not validated" },
  { name: "NodeJS", grammar: "javascript", extension: "js", icon: siNodedotjs, color: "#5fa04e", category: "Web", description: "ESLint code quality rules and safe fixes" },
  { name: "MongoDB", grammar: "json", parserLabel: "JSON syntax · no query semantics", extension: "json", icon: siMongodb, color: "#47a248", category: "Databases", description: "MongoDB document JSON; operators and query semantics are not validated" },
  { name: "JSON", grammar: "json", extension: "json", icon: null, color: "#7a9cc9", category: "Databases", description: "JSON document syntax" },
  { name: "Spring Boot", grammar: "java", extension: "java", icon: siSpring, color: "#6db33f", category: "Web", description: "Java syntax for Spring Boot projects" },
  { name: "React", grammar: "tsx", extension: "jsx", icon: siReact, color: "#61dafb", category: "Web", description: "JSX syntax and ESLint JavaScript rules" },
  { name: "PostgreSQL", grammar: "sql", parserLabel: "PostgreSQL SQL syntax parser", extension: "sql", icon: siPostgresql, color: "#4169e1", category: "Databases", description: "PostgreSQL dialect syntax checks" },
  { name: "Pygame", grammar: "python", extension: "py", icon: siPython, color: "#3776ab", category: "Programming", description: "Python syntax for Pygame projects" },
];

const starters = {
  HTML: "<!DOCTYPE html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\">\n    <title>My page</title>\n  </head>\n  <body>\n    <h1>Hello, world!</h1>\n  </body>\n</html>",
  Python: "def greet(name):\n    return f\"Hello, {name}!\"\n\nprint(greet(\"world\"))",
  JavaScript: "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet(\"world\"));",
  Java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, world!\");\n    }\n}",
  MySQL: "SELECT 'Hello, world!' AS message;",
  C: "#include <stdio.h>\n\nint main(void) {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}",
  "C++": "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, world!\\n\";\n    return 0;\n}",
  PHP: "<?php\necho \"Hello, world!\";",
  "C#": "using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"Hello, world!\");\n    }\n}",
  FastAPI: "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get(\"/\")\ndef read_root():\n    return {\"message\": \"Hello, world!\"}",
  Lua: "local function greet(name)\n  return \"Hello, \" .. name .. \"!\"\nend\n\nprint(greet(\"world\"))",
  "PL/SQL": "SELECT 'Hello, world!' AS message FROM dual;",
  NodeJS: "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet(\"world\"));",
  MongoDB: "{\n  \"name\": \"Ada\",\n  \"active\": true\n}",
  JSON: "{\n  \"message\": \"Hello, world!\"\n}",
  "Spring Boot": "import org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n\n@SpringBootApplication\npublic class Application {\n    public static void main(String[] args) {\n        SpringApplication.run(Application.class, args);\n    }\n}",
  React: "export default function App() {\n  return <main>Hello, world!</main>;\n}",
  PostgreSQL: "SELECT 'Hello, world!' AS message;",
  Pygame: "import pygame\n\npygame.init()\nscreen = pygame.display.set_mode((640, 480))\npygame.display.set_caption(\"Hello, world!\")\npygame.quit()",
};

export const LANGUAGE_PROFILES = profiles.map((profile) => ({ ...profile, starter: starters[profile.name] }));
export const EDITOR_LANGUAGES = LANGUAGE_PROFILES.map(({ name }) => name);
export const LANGUAGE_CATEGORIES = ["Popular", "Programming", "Web", "Databases"];
export const getLanguageProfile = (name) => LANGUAGE_PROFILES.find((profile) => profile.name === name) ?? LANGUAGE_PROFILES[2];
