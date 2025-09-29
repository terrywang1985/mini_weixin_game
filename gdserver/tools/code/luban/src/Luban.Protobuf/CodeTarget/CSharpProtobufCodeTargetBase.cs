﻿using Luban.CodeTarget;
using Luban.Protobuf.TemplateExtensions;
using Luban.Utils;
using Scriban;

namespace Luban.Protobuf.CodeTarget;

public class CSharpProtobufCodeTargetBase : TemplateCodeTargetBase
{
    protected override string CommonTemplateSearchPath => "pb";

    protected override string TemplateDir => "cs_pb";

    protected override string FileSuffixName => "cs";

    public override string FileHeader => CommonFileHeaders.AUTO_GENERATE_C_LIKE;

    private static readonly HashSet<string> s_preservedKeyWords = new()
    {
        "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked", "class", "const", "continue", "decimal", "default", "delegate",
        "do", "double", "else", "enum", "event", "explicit", "extern", "false", "finally", "fixed", "float", "for", "foreach", "goto", "if", "implicit", "in",
        "int", "interface", "internal", "is", "lock", "long", "namespace", "new", "null", "object", "operator", "out", "override", "params", "private", "protected",
        "public", "readonly", "ref", "return", "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string", "struct", "switch", "this", "throw", "true",
        "try", "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void", "volatile", "while"
    };

    protected override IReadOnlySet<string> PreservedKeyWords => s_preservedKeyWords;

    protected override string GetFileNameWithoutExtByTypeName(string name)
    {
        return name.Replace('.', '/');
    }

    public override void Handle(GenerationContext ctx, OutputFileManifest manifest)
    {
        var writer = new CodeWriter();
        GenerateTables(ctx, ctx.ExportTables, writer);
        manifest.AddFile(CreateOutputFile($"{GetFileNameWithoutExtByTypeName(ctx.Target.Manager)}.{FileSuffixName}", writer.ToResult(FileHeader)));
    }

    protected override void OnCreateTemplateContext(TemplateContext ctx)
    {
        ctx.PushGlobal(new CsharpProtobufTemplateExtension());
    }

}
