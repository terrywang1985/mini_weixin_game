using System.Text;
using System.Text.Json;
using Luban.DataExporter.Builtin.Json;
using Luban.DataTarget;
using Luban.Defs;
using Luban.Protobuf.DataVisitors;
using Luban.Utils;

namespace Luban.Protobuf.DataTarget;

[DataTarget("protobuf2-json")]
public class Protobuf2JsonDataTarget : JsonDataTarget
{
    protected override string DefaultOutputFileExt => "json";

    protected override JsonDataVisitor ImplJsonDataVisitor => Protobuf2JsonDataVisitor.Ins;

    public void WriteAsTable(List<Record> datas, Utf8JsonWriter x)
    {
        x.WriteStartObject();
        // 如果修改了这个名字，请同时修改table.tpl
        x.WritePropertyName("data_list");
        x.WriteStartArray();
        foreach (var d in datas)
        {
            d.Data.Apply(Protobuf2JsonDataVisitor.Ins, x);
        }
        x.WriteEndArray();
        x.WriteEndObject();
    }

    public override OutputFile ExportTable(DefTable table, List<Record> records)
    {
        var ss = new MemoryStream();
        var jsonWriter = new Utf8JsonWriter(ss, new JsonWriterOptions()
        {
            Indented = !UseCompactJson,
            SkipValidation = false,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        });
        WriteAsTable(records, jsonWriter);
        jsonWriter.Flush();
        return CreateOutputFile($"{table.OutputDataFile}.{OutputFileExt}", Encoding.UTF8.GetString(DataUtil.StreamToBytes(ss)));
    }
}
