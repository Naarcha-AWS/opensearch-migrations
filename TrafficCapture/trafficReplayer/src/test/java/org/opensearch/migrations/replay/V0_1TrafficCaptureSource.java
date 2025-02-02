package org.opensearch.migrations.replay;

import org.opensearch.migrations.replay.datatypes.ITrafficStreamKey;
import org.opensearch.migrations.replay.traffic.source.ISimpleTrafficCaptureSource;
import org.opensearch.migrations.replay.traffic.source.ITrafficStreamWithKey;
import org.opensearch.migrations.replay.traffic.source.InputStreamOfTraffic;
import org.opensearch.migrations.replay.traffic.source.TrafficStreamWithEmbeddedKey;
import org.opensearch.migrations.trafficcapture.protos.TrafficStream;

import java.io.EOFException;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.zip.GZIPInputStream;

public class V0_1TrafficCaptureSource implements ISimpleTrafficCaptureSource {

    public static final int NUM_TRAFFIC_STREAMS_TO_READ = 1 * 1000;

    private static class Progress {
        boolean lastWasRead;
        int requestCount;

        public void add(TrafficStream incoming) {
            var list = incoming.getSubStreamList();
            lastWasRead = list.size() == 0 ? lastWasRead :
                    Optional.of(list.get(list.size()-1)).map(tso->tso.hasRead() || tso.hasReadSegment()).get();
            requestCount += list.stream().filter(tso->tso.hasRead()||tso.hasReadSegment()).count();
        }
    }

    private final InputStreamOfTraffic trafficSource;
    private final HashMap<String, Progress> connectionProgressMap;
    private final AtomicInteger numberOfTrafficStreamsToRead = new AtomicInteger(NUM_TRAFFIC_STREAMS_TO_READ);

    public V0_1TrafficCaptureSource(String filename) throws IOException {
        var compressedIs = new FileInputStream(filename);
        var is = new GZIPInputStream(compressedIs);
        trafficSource = new InputStreamOfTraffic(is);
        connectionProgressMap = new HashMap<>();
    }

    @Override
    public void commitTrafficStream(ITrafficStreamKey trafficStreamKey) {
        // do nothing
    }

    @Override
    public CompletableFuture<List<ITrafficStreamWithKey>> readNextTrafficStreamChunk() {
        if (numberOfTrafficStreamsToRead.get() <= 0) {
            return CompletableFuture.failedFuture(new EOFException());
        }
        return trafficSource.readNextTrafficStreamChunk()
                .thenApply(ltswk->{
                    var transformed = ltswk.stream().map(this::upgradeTrafficStream).collect(Collectors.toList());
                    var oldValue = numberOfTrafficStreamsToRead.get();
                    var newValue = oldValue-transformed.size();
                    var exchangeResult = numberOfTrafficStreamsToRead.compareAndExchange(oldValue, newValue);
                    assert exchangeResult == oldValue : "didn't expect to be running with a race condition here";
                    return transformed;
                });
    }

    private ITrafficStreamWithKey upgradeTrafficStream(ITrafficStreamWithKey streamWithKey) {
        var incoming = streamWithKey.getStream();
        var outgoingBuilder = TrafficStream.newBuilder()
                .setNodeId(incoming.getNodeId())
                .setConnectionId(incoming.getConnectionId());
        if (incoming.hasNumber()) {
            outgoingBuilder.setNumber(incoming.getNumber());
        } else {
            outgoingBuilder.setNumberOfThisLastChunk(incoming.getNumberOfThisLastChunk());
        }
        var progress = connectionProgressMap.get(incoming.getConnectionId());
        if (progress == null) {
            progress = new Progress();
            progress.lastWasRead = streamWithKey.getKey().getTrafficStreamIndex() != 0;
            connectionProgressMap.put(incoming.getConnectionId(), progress);
        }
        outgoingBuilder.setLastObservationWasUnterminatedRead(progress.lastWasRead);
        outgoingBuilder.setPriorRequestsReceived(progress.requestCount);
        outgoingBuilder.addAllSubStream(incoming.getSubStreamList());
        progress.add(incoming);
        if (incoming.hasNumberOfThisLastChunk()) {
            connectionProgressMap.remove(incoming.getConnectionId());
        }
        return new TrafficStreamWithEmbeddedKey(outgoingBuilder.build());
    }

    @Override
    public void close() {
        // do nothing
    }
}
