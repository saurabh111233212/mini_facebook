package edu.upenn.cis.nets212.config;

/**
 * Global configuration for NETS 212 homeworks.
 * 
 * A better version of this would read a config file from the resources,
 * such as a YAML file.  But our first version is designed to be simple
 * and minimal. 
 * 
 * @author zives
 *
 */
public class Config {

	public static final String DYNAMODB_URL = "https://dynamodb.us-east-1.amazonaws.com";
	public static int DYNAMODB_LOCAL_PORT = 8000;
	public static boolean LOCAL_DB = false;
	
	public static String LOCAL_SPARK = "local[*]";
	
	public static final String AWS_ACCESS = "ASIA2LPLCCIY5OGQELGQ";
	public static final String AWS_SECRET = "PMXR0c8rrRvInrSLh8raETHZuP5EOYVwRZzDhJm+";
	public static final String AWS_SESSION = "FwoGZXIvYXdzEFsaDDuzPMeM28Umk/rSBiLCARJAKyIRCLDvcxDaJPYyxcd7w2HssEMmzNRkhNFQvbE82S5SFTE4NNdXWnAT/CnoiOe9YCcK0CV1WZxdd/PX20g7ZYK8qShgN9Uig7lBLrrJ3K7teQ4eaxIs9DKQS0t3rzbzJ4jd8BfWYUP+VEs6q9GnaVfShIoF13ec+FvnHcrmvdZT9T8aicSFvRB1bAnaqKIa5CUqKsNwh+UlBdqBoFOnTyIGWG9zPq7yS0vZLxMzsB0jsAQDKoOyr+06dTNSz1vnKPKi4P4FMi3f33RVgv7hxV83PO19OjeTT38OiphvWZUelRF70xHSutcaxqZbLsFYHD32Aro=";

	/**
	 * How many RDD partitions to use?
	 */
	public static int PARTITIONS = 5;
}
