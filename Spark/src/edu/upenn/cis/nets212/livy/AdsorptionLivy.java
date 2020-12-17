package edu.upenn.cis.nets212.hw3.livy;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;

import edu.upenn.cis.nets212.config.Config;

//Computes the social rank by submitting spark jobs to Livy. 
public class AdsorptionLivy {
	public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
		int imax = 15;
		LivyClient client = new LivyClientBuilder()
				  .setURI(new URI("http://ec2-3-93-219-224.compute-1.amazonaws.com:8998/"))
				  .build();

		try {
			String jar = "target/nets212-hw3-0.0.1-SNAPSHOT.jar";
			
		  System.out.printf("Uploading %s to the Spark context...\n", jar);
		  client.uploadJar(new File(jar)).get();
		  
		  String sourceFile = "target/archive.txt";

		  System.out.printf("Running Adsorption with %s as its input...\n", sourceFile);
		  List<MyPair<Integer,Double>> result = client.submit(new AdosprtionJob(true, sourceFile, imax).get();
		  
		  
		} finally {
		  client.stop(true);
		}
	}

}
