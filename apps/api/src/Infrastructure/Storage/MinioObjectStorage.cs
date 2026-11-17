namespace CleanMinimalApi.Infrastructure.Storage;

using Application.Storage;
using Minio;
using Minio.DataModel.Args;

internal sealed class MinioObjectStorage(IMinioClient client, string bucket) : IObjectStorage
{
    public async Task<string> UploadAsync(Stream content, string key, string contentType, CancellationToken cancellationToken = default)
    {
        await client.PutObjectAsync(new PutObjectArgs().WithBucket(bucket).WithObject(key).WithStreamData(content)
            .WithObjectSize(content.Length).WithContentType(contentType), cancellationToken);
        return key;
    }

    public async Task<Stream> DownloadAsync(string key, CancellationToken cancellationToken = default)
    {
        var output = new MemoryStream();
        try
        {
            await client.GetObjectAsync(new GetObjectArgs().WithBucket(bucket).WithObject(key)
                .WithCallbackStream(stream => stream.CopyTo(output)), cancellationToken);
            output.Position = 0;
            return output;
        }
        catch { output.Dispose(); throw; }
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken = default) =>
        await client.RemoveObjectAsync(new RemoveObjectArgs().WithBucket(bucket).WithObject(key), cancellationToken);

    public async Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        try { await client.StatObjectAsync(new StatObjectArgs().WithBucket(bucket).WithObject(key), cancellationToken); return true; }
        catch (Minio.Exceptions.ObjectNotFoundException) { return false; }
    }
}
